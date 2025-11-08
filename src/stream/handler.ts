/**
 * Stream handler for managing Bedrock ConverseStream API interactions.
 *
 * This module provides the StreamHandler class that processes streaming
 * responses from the Bedrock API and transforms them into framework events.
 */

import type {
    BedrockRuntimeClient,
    ConverseStreamCommandInput,
    ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { Tracer } from '@aws-lambda-powertools/tracer';
import { StreamError, ErrorCode } from '../errors/index.js';
import type {
    StreamEvent,
    MessageStartEvent,
    ContentBlockStartEvent,
    ContentBlockDeltaEvent,
    ContentBlockStopEvent,
    MessageStopEvent,
    MetadataEvent,
    ErrorEvent,
    StreamHandlerConfig,
} from './types.js';
import type { ContentBlock } from '../config/message-types.js';
import { TracerHelper } from '../observability/tracer.js';

/**
 * StreamHandler manages streaming interactions with the Bedrock ConverseStream API.
 *
 * It processes the stream of events from Bedrock and transforms them into
 * framework-specific events that can be consumed by the Agent class.
 */
export class StreamHandler {
    private tracerHelper: TracerHelper;
    private config: Required<StreamHandlerConfig>;

    constructor(
        private bedrockClient: BedrockRuntimeClient,
        private logger: Logger,
        tracer: Tracer,
        config?: StreamHandlerConfig,
    ) {
        this.tracerHelper = new TracerHelper(tracer);
        this.config = {
            enableDebugLogging: config?.enableDebugLogging ?? false,
            streamTimeout: config?.streamTimeout ?? 300000, // 5 minutes default
        };
    }

    /**
     * Handles a streaming request to the Bedrock API.
     *
     * This async generator yields stream events as they arrive from the API.
     * It automatically handles event transformation, error handling, and
     * observability integration.
     *
     * @param request - Bedrock ConverseStream API request
     * @yields StreamEvent objects as they are received
     * @throws StreamError if the stream fails or times out
     */
    async *handleStream(
        request: ConverseStreamCommandInput,
    ): AsyncGenerator<StreamEvent, void, unknown> {
        this.logger.debug('Starting stream request', {
            modelId: request.modelId,
            messageCount: request.messages?.length,
        });

        // Create tracer subsegment for the stream operation
        const streamStartTime = Date.now();
        const eventCount = 0;

        try {
            // Execute the stream request within a tracer subsegment
            yield* await this.tracerHelper.withSubsegment('BedrockConverseStream', async () => {
                this.tracerHelper.addAnnotation('modelId', request.modelId ?? 'unknown');
                this.tracerHelper.addAnnotation('streaming', true);

                const command = new ConverseStreamCommand(request);
                const response = await this.bedrockClient.send(command);

                if (!response.stream) {
                    throw new StreamError(
                        'No stream returned from Bedrock API',
                        ErrorCode.STREAM_ERROR,
                    );
                }

                return this.processStream(response.stream, streamStartTime);
            });

            this.logger.info('Stream completed successfully', {
                eventCount,
                durationMs: Date.now() - streamStartTime,
            });
        } catch (error) {
            this.handleStreamError(error as Error);
        }
    }

    /**
     * Processes the stream of events from Bedrock.
     *
     * @param stream - Async iterable stream from Bedrock
     * @param startTime - Stream start timestamp for metrics
     * @yields Transformed StreamEvent objects
     */
    private async *processStream(
        stream: AsyncIterable<ConverseStreamOutput>,
        startTime: number,
    ): AsyncGenerator<StreamEvent, void, unknown> {
        let eventCount = 0;

        try {
            for await (const chunk of stream) {
                eventCount++;

                // Process the stream event
                const event = this.processStreamEvent(chunk);

                if (event) {
                    if (this.config.enableDebugLogging) {
                        this.logger.debug('Stream event received', {
                            eventType: event.type,
                            eventNumber: eventCount,
                        });
                    }

                    yield event;
                }
            }

            // Emit metadata event with final metrics
            const durationMs = Date.now() - startTime;
            this.logger.debug('Stream processing complete', {
                eventCount,
                durationMs,
            });
        } catch (error) {
            // Transform and yield error event
            const errorEvent = this.createErrorEvent(error as Error);
            yield errorEvent;
            throw error;
        }
    }

    /**
     * Processes a single stream event from Bedrock and transforms it
     * into a framework StreamEvent.
     *
     * @param event - Raw event from Bedrock ConverseStream API
     * @returns Transformed StreamEvent or null if event should be skipped
     */
    private processStreamEvent(event: ConverseStreamOutput): StreamEvent | null {
        try {
            // Handle messageStart event
            if (event.messageStart) {
                this.logger.debug('Message start event', {
                    role: event.messageStart.role,
                });

                return {
                    type: 'messageStart',
                    role: 'assistant',
                } as MessageStartEvent;
            }

            // Handle contentBlockStart event
            if (event.contentBlockStart) {
                const { contentBlockIndex, start } = event.contentBlockStart;

                this.logger.debug('Content block start event', {
                    contentBlockIndex,
                });

                return {
                    type: 'contentBlockStart',
                    contentBlockIndex: contentBlockIndex ?? 0,
                    start: this.transformContentBlockStart(start),
                } as ContentBlockStartEvent;
            }

            // Handle contentBlockDelta event
            if (event.contentBlockDelta) {
                const { contentBlockIndex, delta } = event.contentBlockDelta;

                if (this.config.enableDebugLogging) {
                    this.logger.debug('Content block delta event', {
                        contentBlockIndex,
                        deltaType: delta?.text ? 'text' : 'toolUse',
                    });
                }

                return {
                    type: 'contentBlockDelta',
                    contentBlockIndex: contentBlockIndex ?? 0,
                    delta: this.transformDelta(delta),
                } as ContentBlockDeltaEvent;
            }

            // Handle contentBlockStop event
            if (event.contentBlockStop) {
                const { contentBlockIndex } = event.contentBlockStop;

                this.logger.debug('Content block stop event', {
                    contentBlockIndex,
                });

                return {
                    type: 'contentBlockStop',
                    contentBlockIndex: contentBlockIndex ?? 0,
                } as ContentBlockStopEvent;
            }

            // Handle messageStop event
            if (event.messageStop) {
                const { stopReason, additionalModelResponseFields } = event.messageStop;

                this.logger.debug('Message stop event', {
                    stopReason,
                });

                this.tracerHelper.addAnnotation('stopReason', stopReason ?? 'unknown');

                return {
                    type: 'messageStop',
                    stopReason: (stopReason as any) ?? 'end_turn',
                    additionalModelResponseFields,
                } as MessageStopEvent;
            }

            // Handle metadata event (usage statistics)
            if (event.metadata) {
                const { usage } = event.metadata;

                if (usage) {
                    this.logger.debug('Metadata event', {
                        inputTokens: usage.inputTokens,
                        outputTokens: usage.outputTokens,
                        totalTokens: usage.totalTokens,
                    });

                    this.tracerHelper.addAnnotation('inputTokens', usage.inputTokens ?? 0);
                    this.tracerHelper.addAnnotation('outputTokens', usage.outputTokens ?? 0);

                    return {
                        type: 'metadata',
                        usage: {
                            inputTokens: usage.inputTokens ?? 0,
                            outputTokens: usage.outputTokens ?? 0,
                            totalTokens: usage.totalTokens ?? 0,
                        },
                    } as MetadataEvent;
                }
            }

            // Handle internal server exception
            if (event.internalServerException) {
                throw new StreamError(
                    event.internalServerException.message ?? 'Internal server error',
                    ErrorCode.API_INTERNAL_ERROR,
                    undefined,
                    { exception: event.internalServerException },
                );
            }

            // Handle model stream error exception
            if (event.modelStreamErrorException) {
                throw new StreamError(
                    event.modelStreamErrorException.message ?? 'Model stream error',
                    ErrorCode.STREAM_ERROR,
                    undefined,
                    { exception: event.modelStreamErrorException },
                );
            }

            // Handle throttling exception
            if (event.throttlingException) {
                throw new StreamError(
                    event.throttlingException.message ?? 'Request throttled',
                    ErrorCode.API_THROTTLED,
                    undefined,
                    { exception: event.throttlingException },
                );
            }

            // Handle validation exception
            if (event.validationException) {
                throw new StreamError(
                    event.validationException.message ?? 'Validation error',
                    ErrorCode.VALIDATION_ERROR,
                    undefined,
                    { exception: event.validationException },
                );
            }

            // Unknown event type - log and skip
            if (this.config.enableDebugLogging) {
                this.logger.debug('Unknown stream event type', { event });
            }

            return null;
        } catch (error) {
            throw new StreamError(
                'Failed to process stream event',
                ErrorCode.STREAM_PARSE_ERROR,
                error as Error,
                { event },
            );
        }
    }

    /**
     * Transforms the content block start data from Bedrock format
     * to framework format.
     *
     * @param start - Content block start data from Bedrock
     * @returns Partial ContentBlock in framework format
     */
    private transformContentBlockStart(start: any): Partial<ContentBlock> {
        if (!start) {
            return {};
        }

        // Handle tool use start
        if (start.toolUse) {
            return {
                toolUse: {
                    toolUseId: start.toolUse.toolUseId ?? '',
                    name: start.toolUse.name ?? '',
                    input: {},
                },
            };
        }

        // For text content, start is typically empty
        return {};
    }

    /**
     * Transforms delta data from Bedrock format to framework format.
     *
     * @param delta - Delta data from Bedrock
     * @returns Transformed delta object
     */
    private transformDelta(delta: any): { text: string } | { toolUse: { input: string } } {
        if (!delta) {
            return { text: '' };
        }

        // Handle text delta
        if (delta.text !== undefined) {
            return { text: delta.text };
        }

        // Handle tool use input delta
        if (delta.toolUse) {
            return {
                toolUse: {
                    input: delta.toolUse.input ?? '',
                },
            };
        }

        return { text: '' };
    }

    /**
     * Creates an error event from an Error object.
     *
     * @param error - Error that occurred
     * @returns ErrorEvent object
     */
    private createErrorEvent(error: Error): ErrorEvent {
        const streamError =
            error instanceof StreamError
                ? error
                : new StreamError('Stream processing failed', ErrorCode.STREAM_ERROR, error);

        return {
            type: 'error',
            error: streamError.message,
            code: streamError.code,
            details: streamError.context,
        };
    }

    /**
     * Handles stream errors by logging and throwing appropriate exceptions.
     *
     * @param error - Error that occurred during streaming
     * @throws StreamError with appropriate error code and context
     */
    private handleStreamError(error: Error): never {
        this.logger.error('Stream error occurred', {
            error: error.message,
            errorName: error.name,
            errorStack: error.stack,
        });

        this.tracerHelper.addAnnotation('streamError', true);
        this.tracerHelper.addMetadata('error', {
            message: error.message,
            name: error.name,
        });

        // If already a StreamError, rethrow it
        if (error instanceof StreamError) {
            throw error;
        }

        // Wrap other errors in StreamError
        throw new StreamError(`Stream failed: ${error.message}`, ErrorCode.STREAM_ERROR, error);
    }
}
