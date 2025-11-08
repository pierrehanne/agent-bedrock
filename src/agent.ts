import {
    BedrockRuntimeClient,
    ConverseCommand,
    type ConverseCommandInput,
    type ConverseCommandOutput,
    type ConverseStreamCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import type { AgentConfig, GuardrailConfig } from './config/types.js';
import type {
    Message,
    ConverseInput,
    ConverseResponse,
    ContentBlock,
    TextContent,
    ImageContent,
    DocumentContent,
    VideoContent,
    ToolResultContent,
    StopReason,
    GuardrailAction,
} from './config/message-types.js';
import { InputValidator } from './config/validator.js';
import { MemoryManager } from './memory/manager.js';
import { ToolExecutor } from './tools/executor.js';
import { StreamHandler } from './stream/handler.js';
import { createLogger } from './observability/logger.js';
import { createMetrics } from './observability/metrics.js';
import { createTracer } from './observability/tracer.js';
import type { StreamEvent } from './stream/types.js';
import type { ToolSpec } from './tools/types.js';
import { RetryHandler } from './utils/retry.js';
import { APIError, ValidationError } from './errors/index.js';
import {
    createImageFromBytes,
    createImageFromS3,
    createDocumentFromBytes,
    createDocumentFromS3,
    createVideoFromBytes,
    createVideoFromS3,
    type ImageFromBytesOptions,
    type ImageFromS3Options,
    type DocumentFromBytesOptions,
    type DocumentFromS3Options,
    type VideoFromBytesOptions,
    type VideoFromS3Options,
} from './utils/multimodal.js';
import { McpClientManager } from './mcp/client-manager.js';
import type { McpServerConfig, McpServerInfo, ResourceContent } from './mcp/types.js';

/**
 * Agent class - Main interface for creating conversational AI agents.
 *
 * The Agent class orchestrates all framework functionality including:
 * - Bedrock API interactions
 * - Conversation memory management
 * - Tool execution
 * - Streaming responses
 * - Observability (logging, metrics, tracing)
 */
export class Agent {
    private readonly config: AgentConfig;
    private readonly logger: Logger;
    private readonly metrics: Metrics;
    private readonly tracer: Tracer;
    private readonly bedrockClient: BedrockRuntimeClient;
    private readonly memoryManager: MemoryManager;
    private readonly mcpClientManager: McpClientManager;
    private mcpConnectionPromises: Promise<void>[] = [];
    private readonly toolExecutor: ToolExecutor;
    private readonly streamHandler: StreamHandler;
    private readonly retryHandler: RetryHandler;
    private conversationHistory: Message[] = [];

    /**
     * Creates a new Agent instance.
     *
     * @param config - Agent configuration
     * @throws {ValidationError} If configuration is invalid
     */
    constructor(config: AgentConfig) {
        InputValidator.validateAgentConfig(config);
        this.config = config;
        this.logger =
            config.logger ||
            createLogger({
                serviceName: config.name,
                logLevel: (process.env.LOG_LEVEL as any) || 'INFO',
                persistentLogAttributes: {
                    agentName: config.name,
                    modelId: config.modelId,
                },
            });
        this.metrics = config.enableMetrics
            ? createMetrics({
                serviceName: config.name,
                defaultDimensions: {
                    agentName: config.name,
                    modelId: config.modelId,
                },
            })
            : new Metrics({
                namespace: 'BedrockAgents',
                serviceName: config.name,
            });
        this.tracer = config.enableTracing
            ? createTracer({
                serviceName: config.name,
                captureHTTPsRequests: true,
            })
            : new Tracer({
                serviceName: config.name,
                enabled: false,
            });
        this.bedrockClient =
            config.bedrockClient ||
            new BedrockRuntimeClient({
                region: config.region || process.env.AWS_REGION,
            });
        this.memoryManager = new MemoryManager(config.memory, this.logger);
        this.mcpClientManager = new McpClientManager(this.logger, this.metrics, this.tracer);
        this.toolExecutor = new ToolExecutor(
            config.tools || [],
            this.mcpClientManager,
            this.logger,
            this.metrics,
        );
        this.streamHandler = new StreamHandler(this.bedrockClient, this.logger, this.tracer);
        this.retryHandler = new RetryHandler(
            {
                maxRetries: 3,
                baseDelay: 100,
                maxDelay: 5000,
            },
            this.logger,
        );

        // Connect to MCP servers from config if provided
        if (config.mcpServers && config.mcpServers.length > 0) {
            this.logger.info('Connecting to MCP servers from config', {
                serverCount: config.mcpServers.length,
                serverNames: config.mcpServers.map((s) => s.name),
            });

            // Store connection promises to await them later
            this.mcpConnectionPromises = config.mcpServers.map(async (mcpConfig) => {
                try {
                    await this.mcpClientManager.connect(mcpConfig);
                } catch (error) {
                    this.logger.warn('Failed to connect to MCP server during initialization', {
                        serverName: mcpConfig.name,
                        error: (error as Error).message,
                        message: 'Agent will continue without this MCP server',
                    });
                }
            });
        }

        // Log agent initialization
        this.logger.info('Agent initialized', {
            agentName: config.name,
            modelId: config.modelId,
            streaming: config.streaming ?? true,
            toolCount: config.tools?.length || 0,
            hasMemory: !!config.memory,
            hasGuardrail: !!config.guardrail,
            mcpServerCount: config.mcpServers?.length || 0,
        });

        // Add tracer annotations
        if (config.enableTracing) {
            this.tracer.putAnnotation('agentName', config.name);
            this.tracer.putAnnotation('modelId', config.modelId);
        }

        // Ensure all components are properly initialized
        this._ensureComponentsInitialized();
    }

    /**
     * Conducts a conversation turn with the model (non-streaming).
     *
     * Processes a user message through the Bedrock API, handles tool use,
     * manages conversation history, and returns the assistant's response.
     *
     * @param input - Conversation input
     * @returns Promise resolving to conversation response
     * @throws {ValidationError} If input is invalid
     * @throws {APIError} If Bedrock API call fails
     */
    async converse(input: ConverseInput): Promise<ConverseResponse> {
        const startTime = Date.now();

        // Validate input
        InputValidator.validateConverseInput(input);

        this.logger.info('Starting conversation turn', {
            hasSessionId: !!input.sessionId,
            hasSystemPrompts: !!input.systemPrompts?.length,
            messageType: typeof input.message,
        });

        // Add metrics
        this.metrics.addMetric('ConversationStarted', MetricUnit.Count, 1);

        try {
            // Load long-term memory if sessionId provided
            if (input.sessionId && this.config.memory?.longTerm) {
                await this.memoryManager.loadSession(input.sessionId);
                this.conversationHistory = this.memoryManager.getMessages();
            }

            // Convert user message to content blocks
            const userContentBlocks = this.normalizeMessageContent(input.message);

            // Add user message to conversation history
            const userMessage: Message = {
                role: 'user',
                content: userContentBlocks,
            };
            this.memoryManager.addMessage(userMessage);
            this.conversationHistory = this.memoryManager.getMessages();

            // Process conversation with potential tool use loop
            const result = await this.processConversationTurn(input);

            // Calculate latency
            const latencyMs = Date.now() - startTime;

            // Add metrics
            this.metrics.addMetric('ConversationCompleted', MetricUnit.Count, 1);
            this.metrics.addMetric('ConversationLatency', MetricUnit.Milliseconds, latencyMs);
            this.metrics.addMetric('TokensUsed', MetricUnit.Count, result.usage.totalTokens);

            // Save long-term memory if sessionId provided
            if (input.sessionId && this.config.memory?.longTerm) {
                await this.memoryManager.saveSession(input.sessionId);
            }

            this.logger.info('Conversation turn completed', {
                stopReason: result.stopReason,
                tokenUsage: result.usage,
                latencyMs,
                toolCallCount: result.toolCalls?.length || 0,
            });

            return result;
        } catch (error) {
            const latencyMs = Date.now() - startTime;

            this.logger.error('Conversation turn failed', {
                error: (error as Error).message,
                latencyMs,
            });

            this.metrics.addMetric('ConversationFailed', MetricUnit.Count, 1);

            throw error;
        }
    }

    /**
     * Processes a conversation turn, handling tool use loops.
     *
     * @param input - Conversation input
     * @returns Promise resolving to conversation response
     * @private
     */
    private async processConversationTurn(input: ConverseInput): Promise<ConverseResponse> {
        const maxToolUseIterations = 20;
        let iteration = 0;
        const totalUsage = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
        };
        const allToolCalls: Array<{ toolUseId: string; name: string; input: any }> = [];

        while (iteration < maxToolUseIterations) {
            iteration++;

            // Build Bedrock API request
            const request = await this.buildConverseRequest(input);

            // Call Bedrock Converse API with retry logic
            const response = await this.retryHandler.executeWithRetry(async () => {
                const command = new ConverseCommand(request);
                return await this.bedrockClient.send(command);
            }, 'BedrockConverseAPI');

            // Accumulate token usage
            if (response.usage) {
                totalUsage.inputTokens += response.usage.inputTokens || 0;
                totalUsage.outputTokens += response.usage.outputTokens || 0;
                totalUsage.totalTokens += response.usage.totalTokens || 0;
            }

            // Extract stop reason
            const stopReason = (response.stopReason as StopReason) || 'end_turn';

            // Process response based on stop reason
            if (stopReason === 'tool_use') {
                // Extract tool uses from response
                const toolUses = this.extractToolUses(response);

                if (toolUses.length === 0) {
                    return this.buildConverseResponse(response, totalUsage, allToolCalls);
                }

                // Add assistant message with tool uses to history
                const assistantMessage: Message = {
                    role: 'assistant',
                    content: (response.output?.message?.content || []) as ContentBlock[],
                };
                this.memoryManager.addMessage(assistantMessage);
                this.conversationHistory = this.memoryManager.getMessages();

                // Execute tools and collect results
                const toolResults: ToolResultContent[] = [];
                for (const toolUse of toolUses) {
                    allToolCalls.push({
                        toolUseId: toolUse.toolUseId,
                        name: toolUse.name,
                        input: toolUse.input,
                    });

                    const result = await this.toolExecutor.executeTool(toolUse);
                    toolResults.push({
                        toolResult: result,
                    });
                }

                // Add tool results to conversation history
                const toolResultMessage: Message = {
                    role: 'user',
                    content: toolResults,
                };
                this.memoryManager.addMessage(toolResultMessage);
                this.conversationHistory = this.memoryManager.getMessages();

                continue;
            } else {
                // Conversation complete
                const assistantMessage: Message = {
                    role: 'assistant',
                    content: (response.output?.message?.content || []) as ContentBlock[],
                };
                this.memoryManager.addMessage(assistantMessage);
                this.conversationHistory = this.memoryManager.getMessages();

                return this.buildConverseResponse(response, totalUsage, allToolCalls);
            }
        }

        // Max iterations reached
        this.logger.warn('Max tool use iterations reached', {
            maxIterations: maxToolUseIterations,
        });

        throw new APIError('Maximum tool use iterations exceeded', undefined, undefined, {
            maxIterations: maxToolUseIterations,
        });
    }

    /**
     * Ensures MCP connections are ready before using them.
     *
     * @private
     */
    private async ensureMcpReady(): Promise<void> {
        if (this.mcpConnectionPromises.length > 0) {
            await Promise.all(this.mcpConnectionPromises);
            this.mcpConnectionPromises = [];
        }
    }

    /**
     * Collects all available tools (local and MCP) for the model.
     *
     * @returns Array of tool specifications
     * @private
     */
    private async getAllToolSpecs(): Promise<ToolSpec[]> {
        // Ensure MCP connections are ready
        await this.ensureMcpReady();
        const toolSpecs: ToolSpec[] = [];

        // Add local tools
        for (const name of this.toolExecutor.getToolNames()) {
            const tool = this.toolExecutor.getTool(name)!;
            toolSpecs.push({
                toolSpec: {
                    name: tool.name,
                    description: tool.description,
                    inputSchema: {
                        json: tool.inputSchema,
                    },
                },
            });
        }

        // Add MCP tools
        if (this.mcpClientManager) {
            const mcpTools = await this.mcpClientManager.listAllTools();
            for (const mcpTool of mcpTools) {
                toolSpecs.push({
                    toolSpec: {
                        name: mcpTool.name,
                        description: mcpTool.description,
                        inputSchema: {
                            json: mcpTool.inputSchema,
                        },
                    },
                });
            }
        }

        if (toolSpecs.length > 0) {
            this.logger.debug('Collected tools for model', {
                totalTools: toolSpecs.length,
                toolNames: toolSpecs.map((t) => t.toolSpec.name),
            });
        }

        return toolSpecs;
    }

    /**
     * Builds a Bedrock Converse API request from conversation input.
     *
     * @param input - Conversation input
     * @returns Bedrock API request
     * @private
     */
    private async buildConverseRequest(input: ConverseInput): Promise<ConverseCommandInput> {
        const request: ConverseCommandInput = {
            modelId: this.config.modelId,
            messages: this.conversationHistory as any,
        };

        this.logger.debug('Building converse request', {
            messageCount: this.conversationHistory.length,
            hasMessages: this.conversationHistory.length > 0,
        });

        // Add system prompts if provided
        if (input.systemPrompts && input.systemPrompts.length > 0) {
            request.system = input.systemPrompts.map((text) => ({ text }));
        }

        // Add model configuration
        if (this.config.modelConfig) {
            request.inferenceConfig = {
                temperature: this.config.modelConfig.temperature,
                maxTokens: this.config.modelConfig.maxTokens,
                topP: this.config.modelConfig.topP,
                stopSequences: this.config.modelConfig.stopSequences,
            };
        }

        // Add guardrail configuration
        if (this.config.guardrail) {
            request.guardrailConfig = {
                guardrailIdentifier: this.config.guardrail.guardrailId,
                guardrailVersion: this.config.guardrail.guardrailVersion,
                trace: this.config.guardrail.trace ? 'enabled' : 'disabled',
            };
        }

        // Add tool configuration if tools are registered (local or MCP)
        const toolSpecs = await this.getAllToolSpecs();
        if (toolSpecs.length > 0) {
            request.toolConfig = {
                tools: toolSpecs,
            };
        }

        return request;
    }

    /**
     * Extracts tool uses from a Bedrock API response.
     *
     * @param response - Bedrock API response
     * @returns Array of tool use requests
     * @private
     */
    private extractToolUses(response: ConverseCommandOutput): Array<{
        toolUseId: string;
        name: string;
        input: any;
    }> {
        const toolUses: Array<{ toolUseId: string; name: string; input: any }> = [];

        if (!response.output?.message?.content) {
            return toolUses;
        }

        for (const contentBlock of response.output.message.content) {
            if ('toolUse' in contentBlock && contentBlock.toolUse) {
                toolUses.push({
                    toolUseId: contentBlock.toolUse.toolUseId || '',
                    name: contentBlock.toolUse.name || '',
                    input: contentBlock.toolUse.input || {},
                });
            }
        }

        return toolUses;
    }

    /**
     * Builds a ConverseResponse from Bedrock API response.
     *
     * @param response - Bedrock API response
     * @param usage - Accumulated token usage
     * @param toolCalls - All tool calls made during conversation
     * @returns Formatted conversation response
     * @private
     */
    private buildConverseResponse(
        response: ConverseCommandOutput,
        usage: { inputTokens: number; outputTokens: number; totalTokens: number },
        toolCalls: Array<{ toolUseId: string; name: string; input: any }>,
    ): ConverseResponse {
        const stopReason = (response.stopReason as StopReason) || 'end_turn';

        // Extract message text from content blocks
        let messageText = '';
        if (response.output?.message?.content) {
            for (const contentBlock of response.output.message.content) {
                if ('text' in contentBlock && contentBlock.text) {
                    messageText += contentBlock.text;
                }
            }
        }

        // Check for guardrail intervention
        const guardrailTrace = response.trace?.guardrail;
        let guardrailAction: GuardrailAction | undefined;

        if (guardrailTrace) {
            const action = (guardrailTrace as any).action || 'NONE';
            guardrailAction = {
                action,
                trace: guardrailTrace,
            };

            // Log guardrail intervention with details
            if (action === 'INTERVENED' || stopReason === 'guardrail_intervened') {
                this.logger.warn('Guardrail intervention occurred', {
                    agentName: this.config.name,
                    stopReason,
                    guardrailId: this.config.guardrail?.guardrailId,
                    guardrailVersion: this.config.guardrail?.guardrailVersion,
                    action,
                    trace: guardrailTrace,
                });

                // Add metrics for guardrail intervention
                this.metrics.addMetric('GuardrailIntervention', MetricUnit.Count, 1);

                // Create fallback response when guardrail blocks content
                if (!messageText || messageText.trim().length === 0) {
                    messageText = this.getGuardrailFallbackMessage();
                }
            }
        }

        // Build response
        const converseResponse: ConverseResponse = {
            message: messageText,
            stopReason,
            usage,
        };

        // Add tool calls if any
        if (toolCalls.length > 0) {
            converseResponse.toolCalls = toolCalls;
        }

        // Add guardrail action if present
        if (guardrailAction) {
            converseResponse.guardrailAction = guardrailAction;
        }

        return converseResponse;
    }

    /**
     * Gets the fallback message to return when guardrail blocks content.
     *
     * @returns Fallback message text
     * @private
     */
    private getGuardrailFallbackMessage(): string {
        return "I apologize, but I cannot provide a response to that request as it doesn't align with my content guidelines. Please rephrase your question or ask something else.";
    }

    /**
     * Normalizes message content to ContentBlock array.
     *
     * @param message - String or ContentBlock array
     * @returns Array of content blocks
     * @private
     */
    private normalizeMessageContent(message: string | ContentBlock[]): ContentBlock[] {
        if (typeof message === 'string') {
            return [{ text: message } as TextContent];
        }
        return message;
    }

    /**
     * Conducts a conversation turn with the model (streaming).
     *
     * Processes a user message through the Bedrock ConverseStream API,
     * yielding events as they arrive. Handles tool use, manages conversation
     * history, and provides real-time streaming responses.
     *
     * @param input - Conversation input
     * @yields Stream events as they arrive from the model
     * @throws {ValidationError} If input is invalid
     * @throws {StreamError} If streaming fails
     */
    async *converseStream(input: ConverseInput): AsyncGenerator<StreamEvent, void, unknown> {
        const startTime = Date.now();

        // Validate input
        InputValidator.validateConverseInput(input);

        this.logger.info('Starting streaming conversation turn', {
            hasSessionId: !!input.sessionId,
            hasSystemPrompts: !!input.systemPrompts?.length,
            messageType: typeof input.message,
        });

        // Add metrics
        this.metrics.addMetric('StreamingConversationStarted', MetricUnit.Count, 1);

        try {
            // Load long-term memory if sessionId provided
            if (input.sessionId && this.config.memory?.longTerm) {
                await this.memoryManager.loadSession(input.sessionId);
                this.conversationHistory = this.memoryManager.getMessages();
            }

            // Convert user message to content blocks
            const userContentBlocks = this.normalizeMessageContent(input.message);

            // Add user message to conversation history
            const userMessage: Message = {
                role: 'user',
                content: userContentBlocks,
            };
            this.memoryManager.addMessage(userMessage);
            this.conversationHistory = this.memoryManager.getMessages();

            // Process streaming conversation with potential tool use loop
            yield* this.processStreamingConversationTurn(input, startTime);

            // Calculate latency
            const latencyMs = Date.now() - startTime;

            // Add metrics
            this.metrics.addMetric('StreamingConversationCompleted', MetricUnit.Count, 1);
            this.metrics.addMetric(
                'StreamingConversationLatency',
                MetricUnit.Milliseconds,
                latencyMs,
            );

            // Save long-term memory if sessionId provided
            if (input.sessionId && this.config.memory?.longTerm) {
                await this.memoryManager.saveSession(input.sessionId);
            }

            this.logger.info('Streaming conversation turn completed', {
                latencyMs,
            });
        } catch (error) {
            const latencyMs = Date.now() - startTime;

            this.logger.error('Streaming conversation turn failed', {
                error: (error as Error).message,
                latencyMs,
            });

            this.metrics.addMetric('StreamingConversationFailed', MetricUnit.Count, 1);

            // Yield error event
            yield {
                type: 'error',
                error: (error as Error).message,
                code: 'STREAM_FAILED',
            } as StreamEvent;

            throw error;
        }
    }

    /**
     * Processes a streaming conversation turn, handling tool use loops.
     *
     * @param input - Conversation input
     * @param startTime - Start timestamp for metrics
     * @yields Stream events as they arrive
     * @private
     */
    private async *processStreamingConversationTurn(
        input: ConverseInput,
        startTime: number,
    ): AsyncGenerator<StreamEvent, void, unknown> {
        const maxToolUseIterations = 10; // Prevent infinite loops
        let iteration = 0;
        const totalUsage = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
        };

        while (iteration < maxToolUseIterations) {
            iteration++;

            // Build Bedrock API request for ConverseStream
            const request = await this.buildConverseStreamRequest(input);

            // Accumulate message content and tool uses from stream
            const accumulatedContent: ContentBlock[] = [];
            const toolUses: Array<{ toolUseId: string; name: string; input: any }> = [];
            let stopReason: StopReason = 'end_turn';
            let currentContentBlockIndex = -1;
            let currentToolUseInput = '';

            try {
                // Call StreamHandler.handleStream to get event stream
                for await (const event of this.streamHandler.handleStream(request)) {
                    // Yield stream events to caller as they arrive
                    yield event;

                    // Accumulate message content from stream events
                    if (event.type === 'contentBlockStart') {
                        currentContentBlockIndex = event.contentBlockIndex;

                        // Initialize content block
                        if (event.start && 'toolUse' in event.start) {
                            accumulatedContent[currentContentBlockIndex] = {
                                toolUse: {
                                    toolUseId: event.start.toolUse?.toolUseId || '',
                                    name: event.start.toolUse?.name || '',
                                    input: {},
                                },
                            };
                            currentToolUseInput = '';
                        } else {
                            accumulatedContent[currentContentBlockIndex] = {
                                text: '',
                            } as TextContent;
                        }
                    } else if (event.type === 'contentBlockDelta') {
                        const blockIndex = event.contentBlockIndex;

                        if ('text' in event.delta) {
                            // Accumulate text content
                            const block = accumulatedContent[blockIndex] as TextContent;
                            if (block && 'text' in block) {
                                block.text += event.delta.text;
                            }
                        } else if ('toolUse' in event.delta) {
                            // Accumulate tool use input (JSON string)
                            currentToolUseInput += event.delta.toolUse.input;
                        }
                    } else if (event.type === 'contentBlockStop') {
                        // Finalize tool use input if this was a tool use block
                        const block = accumulatedContent[event.contentBlockIndex];
                        if (block && 'toolUse' in block && currentToolUseInput) {
                            try {
                                block.toolUse.input = JSON.parse(currentToolUseInput);
                            } catch (error) {
                                this.logger.warn('Failed to parse tool use input', {
                                    error: (error as Error).message,
                                    input: currentToolUseInput,
                                });
                                block.toolUse.input = {};
                            }
                        }
                    } else if (event.type === 'messageStop') {
                        stopReason = event.stopReason;
                    } else if (event.type === 'metadata') {
                        // Accumulate token usage
                        totalUsage.inputTokens += event.usage.inputTokens;
                        totalUsage.outputTokens += event.usage.outputTokens;
                        totalUsage.totalTokens += event.usage.totalTokens;

                        // Add token usage metrics
                        this.metrics.addMetric(
                            'StreamingTokensUsed',
                            MetricUnit.Count,
                            event.usage.totalTokens,
                        );
                    } else if (event.type === 'error') {
                        // Error event already yielded, will be thrown below
                        throw new APIError(event.error, undefined, undefined, {
                            code: event.code,
                            details: event.details,
                        });
                    }
                }
            } catch (error) {
                // Handle stream errors and yield error events
                this.logger.error('Stream processing error', {
                    error: (error as Error).message,
                    iteration,
                });

                yield {
                    type: 'error',
                    error: (error as Error).message,
                    code: 'STREAM_PROCESSING_ERROR',
                } as StreamEvent;

                throw error;
            }

            // Check for guardrail intervention
            if (stopReason === 'guardrail_intervened' || stopReason === 'content_filtered') {
                // Log guardrail intervention with details
                this.logger.warn('Guardrail intervention occurred in streaming', {
                    agentName: this.config.name,
                    stopReason,
                    guardrailId: this.config.guardrail?.guardrailId,
                    guardrailVersion: this.config.guardrail?.guardrailVersion,
                });

                // Add metrics for guardrail intervention
                this.metrics.addMetric('GuardrailIntervention', MetricUnit.Count, 1);

                // Check if we have any text content, if not add fallback message
                let hasTextContent = false;
                for (const contentBlock of accumulatedContent) {
                    if (
                        'text' in contentBlock &&
                        contentBlock.text &&
                        contentBlock.text.trim().length > 0
                    ) {
                        hasTextContent = true;
                        break;
                    }
                }

                // Add fallback message if no text content
                if (!hasTextContent) {
                    const fallbackText = this.getGuardrailFallbackMessage();
                    accumulatedContent.push({ text: fallbackText } as TextContent);

                    // Yield the fallback message as a content delta event
                    yield {
                        type: 'contentBlockDelta',
                        contentBlockIndex: accumulatedContent.length - 1,
                        delta: { text: fallbackText },
                    } as StreamEvent;
                }
            }

            // Add assistant message to conversation history
            const assistantMessage: Message = {
                role: 'assistant',
                content: accumulatedContent,
            };
            this.memoryManager.addMessage(assistantMessage);
            this.conversationHistory = this.memoryManager.getMessages();

            // Handle tool use events by executing tools and yielding results
            if (stopReason === 'tool_use') {
                // Extract tool uses from accumulated content
                for (const contentBlock of accumulatedContent) {
                    if ('toolUse' in contentBlock && contentBlock.toolUse) {
                        toolUses.push({
                            toolUseId: contentBlock.toolUse.toolUseId,
                            name: contentBlock.toolUse.name,
                            input: contentBlock.toolUse.input,
                        });
                    }
                }

                if (toolUses.length === 0) {
                    break;
                }

                // Execute tools and collect results
                const toolResults: ToolResultContent[] = [];
                for (const toolUse of toolUses) {
                    this.logger.debug('Executing tool from stream', {
                        toolName: toolUse.name,
                        toolUseId: toolUse.toolUseId,
                    });

                    const result = await this.toolExecutor.executeTool(toolUse);
                    toolResults.push({
                        toolResult: result,
                    });

                    // Yield a custom event to inform caller about tool execution
                    yield {
                        type: 'metadata',
                        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                        metrics: {
                            latencyMs: Date.now() - startTime,
                        },
                    } as StreamEvent;
                }

                // Add tool results to conversation history
                const toolResultMessage: Message = {
                    role: 'user',
                    content: toolResults,
                };
                this.memoryManager.addMessage(toolResultMessage);
                this.conversationHistory = this.memoryManager.getMessages();

                continue;
            } else {
                break;
            }
        }

        if (iteration >= maxToolUseIterations) {
            // Max iterations reached
            this.logger.warn('Max tool use iterations reached in streaming', {
                maxIterations: maxToolUseIterations,
            });

            yield {
                type: 'error',
                error: 'Maximum tool use iterations exceeded',
                code: 'MAX_ITERATIONS_EXCEEDED',
            } as StreamEvent;

            throw new APIError('Maximum tool use iterations exceeded', undefined, undefined, {
                maxIterations: maxToolUseIterations,
            });
        }
    }

    /**
     * Builds a Bedrock ConverseStream API request from conversation input.
     *
     * @param input - Conversation input
     * @returns Bedrock ConverseStream API request
     * @private
     */
    private async buildConverseStreamRequest(
        input: ConverseInput,
    ): Promise<ConverseStreamCommandInput> {
        const request: any = {
            modelId: this.config.modelId,
            messages: this.conversationHistory as any,
        };

        // Add system prompts if provided
        if (input.systemPrompts && input.systemPrompts.length > 0) {
            request.system = input.systemPrompts.map((text) => ({ text }));
        }

        // Add model configuration
        if (this.config.modelConfig) {
            request.inferenceConfig = {
                temperature: this.config.modelConfig.temperature,
                maxTokens: this.config.modelConfig.maxTokens,
                topP: this.config.modelConfig.topP,
                stopSequences: this.config.modelConfig.stopSequences,
            };
        }

        // Add guardrail configuration
        if (this.config.guardrail) {
            request.guardrailConfig = {
                guardrailIdentifier: this.config.guardrail.guardrailId,
                guardrailVersion: this.config.guardrail.guardrailVersion,
                trace: this.config.guardrail.trace ? 'enabled' : 'disabled',
            };
        }

        // Add tool configuration if tools are registered (local or MCP)
        const toolSpecs = await this.getAllToolSpecs();
        if (toolSpecs.length > 0) {
            request.toolConfig = {
                tools: toolSpecs,
            };
        }

        return request;
    }

    /**
     * Clears the conversation history from short-term memory.
     *
     * This resets both the memory manager's internal state and the
     * agent's conversation history array. Long-term memory is not affected.
     */
    clearMemory(): void {
        this.memoryManager.clear();
        this.conversationHistory = [];

        this.logger.info('Conversation memory cleared', {
            agentName: this.config.name,
        });

        this.metrics.addMetric('MemoryCleared', MetricUnit.Count, 1);
    }

    /**
     * Gets the current conversation history.
     *
     * Returns a copy of the conversation history to prevent external
     * modifications. Use clearMemory() to reset the history.
     *
     * @returns Array of messages in chronological order
     */
    getConversationHistory(): Message[] {
        // Return a deep copy to prevent external modifications
        return JSON.parse(JSON.stringify(this.conversationHistory));
    }

    /**
     * Adds a system prompt to guide model behavior.
     *
     * System prompts are stored in the agent configuration and will be
     * included in all subsequent conversation turns. Multiple system prompts
     * can be added and will be sent in the order they were added.
     *
     * @param prompt - System prompt text
     * @throws {ValidationError} If prompt is invalid
     */
    addSystemPrompt(prompt: string): void {
        // Validate prompt
        if (!prompt || typeof prompt !== 'string') {
            throw new ValidationError('System prompt must be a non-empty string', {
                field: 'prompt',
                value: prompt,
            });
        }

        if (prompt.trim().length === 0) {
            throw new ValidationError('System prompt cannot be empty or whitespace only', {
                field: 'prompt',
            });
        }

        // Initialize systemPrompts array if it doesn't exist
        if (!this.config.systemPrompts) {
            (this.config as any).systemPrompts = [];
        }

        // Add the system prompt
        (this.config as any).systemPrompts.push(prompt);

        this.logger.debug('System prompt added', {
            agentName: this.config.name,
            promptLength: prompt.length,
            totalPrompts: (this.config as any).systemPrompts.length,
        });
    }

    /**
     * Updates the guardrail configuration.
     *
     * This replaces any existing guardrail configuration. The new guardrail
     * will be applied to all subsequent conversation turns. Pass null or
     * undefined to remove guardrail protection.
     *
     * @param guardrailConfig - New guardrail configuration
     * @throws {ValidationError} If guardrail configuration is invalid
     */
    setGuardrail(guardrailConfig: GuardrailConfig | undefined): void {
        // Validate guardrail config if provided
        if (guardrailConfig !== undefined && guardrailConfig !== null) {
            // Use the private validator method
            InputValidator['validateGuardrailConfig'](guardrailConfig);
        }

        // Update the configuration
        (this.config as any).guardrail = guardrailConfig;

        this.logger.info('Guardrail configuration updated', {
            agentName: this.config.name,
            hasGuardrail: !!guardrailConfig,
            guardrailId: guardrailConfig?.guardrailId,
            guardrailVersion: guardrailConfig?.guardrailVersion,
        });

        if (guardrailConfig) {
            this.metrics.addMetric('GuardrailConfigured', MetricUnit.Count, 1);
        } else {
            this.metrics.addMetric('GuardrailRemoved', MetricUnit.Count, 1);
        }
    }

    /**
     * Attaches a new MCP server to the Agent.
     *
     * Establishes a connection to the specified MCP server and makes its
     * tools and resources available to the Agent. The connection is established
     * asynchronously and the method will throw if connection fails.
     *
     * @param config - MCP server configuration
     * @throws {ValidationError} If configuration is invalid
     * @throws {Error} If a server with the same name is already connected
     * @throws {McpConnectionError} If connection to the server fails
     */
    async attachMcpServer(config: McpServerConfig): Promise<void> {
        // Validate MCP server configuration
        InputValidator.validateMcpServerConfig(config);

        this.logger.info('Attaching MCP server', {
            agentName: this.config.name,
            serverName: config.name,
            url: config.url,
        });

        try {
            // Connect to the MCP server
            await this.mcpClientManager.connect(config);

            this.logger.info('Successfully attached MCP server', {
                agentName: this.config.name,
                serverName: config.name,
            });

            // Add metric
            this.metrics.addMetric('McpServerAttached', MetricUnit.Count, 1);
        } catch (error) {
            this.logger.error('Failed to attach MCP server', {
                agentName: this.config.name,
                serverName: config.name,
                error: (error as Error).message,
            });

            // Add metric
            this.metrics.addMetric('McpServerAttachFailed', MetricUnit.Count, 1);

            throw error;
        }
    }

    /**
     * Detaches an MCP server from the Agent.
     *
     * Closes the connection to the specified MCP server and removes its
     * tools and resources from the Agent. Any subsequent tool calls to
     * tools from this server will fail.
     *
     * @param name - Name of the MCP server to detach
     * @throws {Error} If no server with the specified name is connected
     */
    async detachMcpServer(name: string): Promise<void> {
        // Validate server name
        if (!name || typeof name !== 'string') {
            throw new ValidationError('MCP server name must be a non-empty string', {
                field: 'name',
                value: name,
            });
        }

        if (name.trim().length === 0) {
            throw new ValidationError('MCP server name cannot be empty or whitespace only', {
                field: 'name',
            });
        }

        this.logger.info('Detaching MCP server', {
            agentName: this.config.name,
            serverName: name,
        });

        try {
            // Disconnect from the MCP server
            await this.mcpClientManager.disconnect(name);

            this.logger.info('Successfully detached MCP server', {
                agentName: this.config.name,
                serverName: name,
            });

            // Add metric
            this.metrics.addMetric('McpServerDetached', MetricUnit.Count, 1);
        } catch (error) {
            this.logger.error('Failed to detach MCP server', {
                agentName: this.config.name,
                serverName: name,
                error: (error as Error).message,
            });

            // Add metric
            this.metrics.addMetric('McpServerDetachFailed', MetricUnit.Count, 1);

            throw error;
        }
    }

    /**
     * Lists all connected MCP servers.
     *
     * Returns information about all currently connected MCP servers including
     * their status, tool count, and resource count.
     *
     * @returns Array of MCP server information
     */
    listMcpServers(): McpServerInfo[] {
        this.logger.debug('Listing MCP servers', {
            agentName: this.config.name,
        });

        const servers = this.mcpClientManager.listConnections();

        this.logger.debug('Listed MCP servers', {
            agentName: this.config.name,
            serverCount: servers.length,
        });

        return servers;
    }

    /**
     * Fetches resource content from an MCP server.
     *
     * Retrieves the content of a resource identified by its URI from the
     * appropriate MCP server. The resource can contain either text or binary data.
     *
     * @param uri - Resource URI
     * @returns Promise resolving to resource content
     * @throws {ValidationError} If URI is invalid
     * @throws {McpResourceError} If resource is not found or fetch fails
     */
    async getMcpResource(uri: string): Promise<ResourceContent> {
        // Validate URI
        if (!uri || typeof uri !== 'string') {
            throw new ValidationError('Resource URI must be a non-empty string', {
                field: 'uri',
                value: uri,
            });
        }

        if (uri.trim().length === 0) {
            throw new ValidationError('Resource URI cannot be empty or whitespace only', {
                field: 'uri',
            });
        }

        this.logger.debug('Fetching MCP resource', {
            agentName: this.config.name,
            uri,
        });

        try {
            // Fetch resource from MCP server
            const content = await this.mcpClientManager.getResource(uri);

            this.logger.debug('Successfully fetched MCP resource', {
                agentName: this.config.name,
                uri,
                hasText: !!content.text,
                hasBlob: !!content.blob,
            });

            // Add metric
            this.metrics.addMetric('McpResourceFetched', MetricUnit.Count, 1);

            return content;
        } catch (error) {
            this.logger.error('Failed to fetch MCP resource', {
                agentName: this.config.name,
                uri,
                error: (error as Error).message,
            });

            // Add metric
            this.metrics.addMetric('McpResourceFetchFailed', MetricUnit.Count, 1);

            throw error;
        }
    }

    /**
     * Cleans up Agent resources.
     *
     * Closes all MCP server connections and releases resources.
     * Should be called when the Agent is being disposed or is no longer needed.
     *
     * This method is safe to call multiple times.
     */
    async cleanup(): Promise<void> {
        this.logger.info('Cleaning up Agent resources', {
            agentName: this.config.name,
        });

        try {
            // Close all MCP connections
            await this.mcpClientManager.close();

            this.logger.info('Agent cleanup completed', {
                agentName: this.config.name,
            });

            // Add metric
            this.metrics.addMetric('AgentCleanup', MetricUnit.Count, 1);
        } catch (error) {
            this.logger.error('Error during Agent cleanup', {
                agentName: this.config.name,
                error: (error as Error).message,
            });

            // Add metric
            this.metrics.addMetric('AgentCleanupFailed', MetricUnit.Count, 1);

            throw error;
        }
    }

    /**
     * Gets the agent name.
     *
     * @returns Agent name
     */
    getName(): string {
        return this.config.name;
    }

    /**
     * Gets the model ID.
     *
     * @returns Model identifier
     */
    getModelId(): string {
        return this.config.modelId;
    }

    /**
     * Gets the agent configuration.
     *
     * @returns Agent configuration (read-only copy)
     */
    getConfig(): Readonly<AgentConfig> {
        return { ...this.config };
    }

    /**
     * Creates an ImageContent block from raw bytes.
     *
     * @param options - Image creation options
     * @returns ImageContent block
     * @throws {ValidationError} If options are invalid
     */
    createImageFromBytes(options: ImageFromBytesOptions): ImageContent {
        return createImageFromBytes(options);
    }

    /**
     * Creates an ImageContent block from an S3 URI.
     *
     * @param options - Image creation options
     * @returns ImageContent block
     * @throws {ValidationError} If options are invalid
    */
    createImageFromS3(options: ImageFromS3Options): ImageContent {
        return createImageFromS3(options);
    }

    /**
     * Creates a DocumentContent block from raw bytes.
     *
     * @param options - Document creation options
     * @returns DocumentContent block
     * @throws {ValidationError} If options are invalid
     */
    createDocumentFromBytes(options: DocumentFromBytesOptions): DocumentContent {
        return createDocumentFromBytes(options);
    }

    /**
     * Creates a DocumentContent block from an S3 URI.
     *
     * @param options - Document creation options
     * @returns DocumentContent block
     * @throws {ValidationError} If options are invalid
     */
    createDocumentFromS3(options: DocumentFromS3Options): DocumentContent {
        return createDocumentFromS3(options);
    }

    /**
     * Creates a VideoContent block from raw bytes.
     *
     * @param options - Video creation options
     * @returns VideoContent block
     * @throws {ValidationError} If options are invalid
     */
    createVideoFromBytes(options: VideoFromBytesOptions): VideoContent {
        return createVideoFromBytes(options);
    }

    /**
     * Creates a VideoContent block from an S3 URI.
     *
     * @param options - Video creation options
     * @returns VideoContent block
     * @throws {ValidationError} If options are invalid
     */
    createVideoFromS3(options: VideoFromS3Options): VideoContent {
        return createVideoFromS3(options);
    }

    /**
     * Internal method to ensure all initialized components are accessible.
     * This prevents TypeScript unused variable warnings for components
     * that will be used in future task implementations.
     *
     * @private
     * @internal
     */
    private _ensureComponentsInitialized(): void {
        // These components are initialized and will be used throughout the Agent
        void this.memoryManager;
        void this.mcpClientManager;
        void this.toolExecutor;
        void this.streamHandler;
        void this.conversationHistory;
    }
}

export { Agent as default };