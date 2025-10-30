/**
 * Tool execution module for the Agent Bedrock.
 * 
 * This module provides the ToolExecutor class that manages tool registration,
 * validation, and execution for Agent tool use capabilities.
 */

import type { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import type {
    ToolDefinition,
    ToolUse,
    ToolResult,
    ToolSpec,
    JSONSchema,
} from './types.js';
import { ToolExecutionError, McpToolExecutionError } from '../errors/index.js';
import type { McpClientManager } from '../mcp/client-manager.js';

/**
 * Manages tool registration and execution for Agent instances.
 * 
 * The ToolExecutor maintains a registry of available tools, validates
 * tool inputs against JSON schemas, and executes tool handlers with
 * comprehensive error handling and observability. Supports both local
 * tools and MCP server tools.
 * 
 * @example
 * ```typescript
 * const executor = new ToolExecutor(tools, mcpClientManager, logger, metrics);
 * 
 * const result = await executor.executeTool({
 *   toolUseId: 'tool_123',
 *   name: 'get_weather',
 *   input: { location: 'San Francisco' }
 * });
 * ```
 */
export class ToolExecutor {
    /**
     * Registry of local tools indexed by name.
     */
    private tools: Map<string, ToolDefinition>;

    /**
     * MCP Client Manager for accessing MCP server tools.
     */
    private mcpClientManager: McpClientManager | undefined;

    /**
     * AWS Powertools Logger instance.
     */
    private logger: Logger;

    /**
     * AWS Powertools Metrics instance.
     */
    private metrics: Metrics;

    /**
     * Creates a new ToolExecutor instance.
     * 
     * @param toolDefinitions - Array of tool definitions to register
     * @param mcpClientManager - MCP Client Manager for MCP tool access (optional)
     * @param logger - Logger instance for observability
     * @param metrics - Metrics instance for tracking tool execution
     */
    constructor(
        toolDefinitions: ToolDefinition[],
        mcpClientManager: McpClientManager | undefined,
        logger: Logger,
        metrics: Metrics
    ) {
        this.tools = new Map();
        this.mcpClientManager = mcpClientManager;
        this.logger = logger;
        this.metrics = metrics;

        // Register all provided tools
        for (const tool of toolDefinitions) {
            this.registerTool(tool);
        }

        this.logger.debug('ToolExecutor initialized', {
            localToolCount: this.tools.size,
            localToolNames: Array.from(this.tools.keys()),
            hasMcpManager: !!mcpClientManager,
        });
    }

    /**
     * Registers a tool in the executor's registry.
     * 
     * Validates the tool definition and adds it to the registry.
     * If a tool with the same name already exists, it will be replaced.
     * 
     * @param tool - Tool definition to register
     * @throws {ToolExecutionError} If tool definition is invalid
     * 
     * @example
     * ```typescript
     * executor.registerTool({
     *   name: 'calculate',
     *   description: 'Performs mathematical calculations',
     *   inputSchema: {
     *     type: 'object',
     *     properties: {
     *       expression: { type: 'string' }
     *     },
     *     required: ['expression']
     *   },
     *   handler: async (input) => eval(input.expression)
     * });
     * ```
     */
    registerTool(tool: ToolDefinition): void {
        // Validate tool definition
        if (!tool.name || typeof tool.name !== 'string') {
            throw new ToolExecutionError(
                tool.name || 'unknown',
                'Tool name is required and must be a string'
            );
        }

        if (!tool.description || typeof tool.description !== 'string') {
            throw new ToolExecutionError(
                tool.name,
                'Tool description is required and must be a string'
            );
        }

        if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
            throw new ToolExecutionError(
                tool.name,
                'Tool inputSchema is required and must be an object'
            );
        }

        if (!tool.handler || typeof tool.handler !== 'function') {
            throw new ToolExecutionError(
                tool.name,
                'Tool handler is required and must be a function'
            );
        }

        // Validate tool name format (alphanumeric with underscores)
        if (!/^[a-zA-Z0-9_]+$/.test(tool.name)) {
            throw new ToolExecutionError(
                tool.name,
                'Tool name must be alphanumeric with underscores only'
            );
        }

        this.tools.set(tool.name, tool);

        this.logger.debug('Tool registered', {
            toolName: tool.name,
            description: tool.description,
        });
    }

    /**
     * Executes a tool based on a tool use request from the model.
     * 
     * Routes execution to either local tools or MCP server tools based on
     * tool availability. Validates the tool exists, validates the input,
     * executes the handler, and returns a formatted result. Includes
     * comprehensive error handling and observability.
     * 
     * @param toolUse - Tool use request from the model
     * @returns Promise resolving to tool execution result
     * 
     * @example
     * ```typescript
     * const result = await executor.executeTool({
     *   toolUseId: 'tool_abc123',
     *   name: 'get_weather',
     *   input: { location: 'New York' }
     * });
     * ```
     */
    async executeTool(toolUse: ToolUse): Promise<ToolResult> {
        const { toolUseId, name, input } = toolUse;

        this.logger.debug('Tool execution started', {
            toolName: name,
            toolUseId,
            input,
        });

        // Route to local or MCP tool execution
        if (this.isLocalTool(name)) {
            return this.executeLocalTool(toolUse);
        } else {
            return this.executeMcpTool(toolUse);
        }
    }

    /**
     * Checks if a tool is a local tool or an MCP tool.
     * 
     * Local tools take precedence over MCP tools if there's a name conflict.
     * 
     * @param toolName - Name of the tool to check
     * @returns True if tool is local, false if it's an MCP tool
     * 
     * @private
     */
    private isLocalTool(toolName: string): boolean {
        return this.tools.has(toolName);
    }

    /**
     * Executes a local tool.
     * 
     * Validates the tool exists, validates the input against the schema,
     * executes the handler, and returns a formatted result.
     * 
     * @param toolUse - Tool use request from the model
     * @returns Promise resolving to tool execution result
     * 
     * @private
     */
    private async executeLocalTool(toolUse: ToolUse): Promise<ToolResult> {
        const startTime = Date.now();
        const { toolUseId, name, input } = toolUse;

        try {
            // Check if tool exists
            const tool = this.tools.get(name);
            if (!tool) {
                throw new ToolExecutionError(
                    name,
                    `Local tool not found: ${name}`,
                    undefined,
                    { availableTools: Array.from(this.tools.keys()) }
                );
            }

            // Validate tool input
            this.validateToolInput(name, input, tool.inputSchema);

            // Execute tool handler
            const result = await tool.handler(input);

            // Calculate execution time
            const latencyMs = Date.now() - startTime;

            // Log success
            this.logger.info('Local tool execution succeeded', {
                toolName: name,
                toolUseId,
                latencyMs,
            });

            // Record metrics
            this.metrics.addDimensions({ toolName: name, toolType: 'local' });
            this.metrics.addMetric('ToolExecutionSuccess', MetricUnit.Count, 1);
            this.metrics.addMetric('ToolExecutionLatency', MetricUnit.Milliseconds, latencyMs);

            // Return formatted result
            return {
                toolUseId,
                content: [{ text: JSON.stringify(result) }],
                status: 'success',
            };
        } catch (error) {
            // Calculate execution time even for errors
            const latencyMs = Date.now() - startTime;

            // Handle and return error result
            return this.handleToolError(name, toolUseId, error as Error, latencyMs, 'local');
        }
    }

    /**
     * Executes an MCP tool.
     * 
     * Routes the tool call to the appropriate MCP server via the MCP Client Manager.
     * Handles MCP-specific errors and provides fallback responses.
     * 
     * @param toolUse - Tool use request from the model
     * @returns Promise resolving to tool execution result
     * 
     * @private
     */
    private async executeMcpTool(toolUse: ToolUse): Promise<ToolResult> {
        const startTime = Date.now();
        const { toolUseId, name, input } = toolUse;

        // Check if MCP Client Manager is available
        if (!this.mcpClientManager) {
            const latencyMs = Date.now() - startTime;
            const error = new ToolExecutionError(
                name,
                'MCP Client Manager not available',
                undefined,
                { toolName: name }
            );
            return this.handleToolError(name, toolUseId, error, latencyMs, 'mcp');
        }

        try {
            // Execute tool via MCP Client Manager
            const result = await this.mcpClientManager.executeTool(name, input);

            // Calculate execution time
            const latencyMs = Date.now() - startTime;

            // Log success
            this.logger.info('MCP tool execution succeeded', {
                toolName: name,
                toolUseId,
                latencyMs,
            });

            // Record metrics
            this.metrics.addDimensions({ toolName: name, toolType: 'mcp' });
            this.metrics.addMetric('ToolExecutionSuccess', MetricUnit.Count, 1);
            this.metrics.addMetric('McpToolExecutionSuccess', MetricUnit.Count, 1);
            this.metrics.addMetric('ToolExecutionLatency', MetricUnit.Milliseconds, latencyMs);
            this.metrics.addMetric('McpToolExecutionLatency', MetricUnit.Milliseconds, latencyMs);

            // Return formatted result
            return {
                toolUseId,
                content: [{ text: JSON.stringify(result) }],
                status: 'success',
            };
        } catch (error) {
            // Calculate execution time even for errors
            const latencyMs = Date.now() - startTime;

            // Handle and return error result with MCP-specific handling
            return this.handleToolError(name, toolUseId, error as Error, latencyMs, 'mcp');
        }
    }

    /**
     * Validates tool input against the tool's JSON schema.
     * 
     * Performs basic JSON schema validation to ensure the input
     * matches the expected structure and required fields.
     * 
     * @param toolName - Name of the tool
     * @param input - Input to validate
     * @param schema - JSON schema to validate against
     * @throws {ToolExecutionError} If validation fails
     * 
     * @private
     */
    private validateToolInput(
        toolName: string,
        input: any,
        schema: JSONSchema
    ): void {
        // Check if input is provided
        if (input === undefined || input === null) {
            throw new ToolExecutionError(
                toolName,
                'Tool input is required',
                undefined,
                { schema }
            );
        }

        // Validate type
        if (schema.type === 'object' && typeof input !== 'object') {
            throw new ToolExecutionError(
                toolName,
                `Tool input must be an object, got ${typeof input}`,
                undefined,
                { schema, input }
            );
        }

        // Validate required fields
        if (schema.required && Array.isArray(schema.required)) {
            for (const requiredField of schema.required) {
                if (!(requiredField in input)) {
                    throw new ToolExecutionError(
                        toolName,
                        `Missing required field: ${requiredField}`,
                        undefined,
                        { schema, input, missingField: requiredField }
                    );
                }
            }
        }

        // Validate property types if properties are defined
        if (schema.properties && typeof input === 'object') {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                if (propName in input) {
                    const value = input[propName];
                    const expectedType = (propSchema as any).type;

                    if (expectedType && !this.validateType(value, expectedType)) {
                        throw new ToolExecutionError(
                            toolName,
                            `Invalid type for field '${propName}': expected ${expectedType}, got ${typeof value}`,
                            undefined,
                            { schema, input, field: propName }
                        );
                    }
                }
            }
        }

        this.logger.debug('Tool input validated', {
            toolName,
            inputKeys: Object.keys(input),
        });
    }

    /**
     * Validates a value against a JSON schema type.
     * 
     * @param value - Value to validate
     * @param expectedType - Expected JSON schema type
     * @returns True if value matches type, false otherwise
     * 
     * @private
     */
    private validateType(value: any, expectedType: string): boolean {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
            case 'integer':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'array':
                return Array.isArray(value);
            case 'null':
                return value === null;
            default:
                // Unknown type, allow it
                return true;
        }
    }

    /**
     * Handles tool execution errors and creates error tool results.
     * 
     * Logs the error, records metrics, and returns a formatted error
     * result that can be sent back to the model. Provides fallback
     * responses for MCP tool execution failures.
     * 
     * @param toolName - Name of the tool that failed
     * @param toolUseId - Tool use identifier
     * @param error - Error that occurred
     * @param latencyMs - Execution time before error
     * @param toolType - Type of tool ('local' or 'mcp')
     * @returns Tool result with error information
     * 
     * @private
     */
    private handleToolError(
        toolName: string,
        toolUseId: string,
        error: Error,
        latencyMs: number,
        toolType: 'local' | 'mcp' = 'local'
    ): ToolResult {
        // Log error with tool type context
        this.logger.error('Tool execution failed', {
            toolName,
            toolUseId,
            toolType,
            error: error.message,
            errorStack: error.stack,
            latencyMs,
        });

        // Record metrics with tool type dimension
        this.metrics.addDimensions({ toolName, toolType });
        this.metrics.addMetric('ToolExecutionFailure', MetricUnit.Count, 1);
        this.metrics.addMetric('ToolExecutionLatency', MetricUnit.Milliseconds, latencyMs);

        // Add MCP-specific failure metric
        if (toolType === 'mcp') {
            this.metrics.addMetric('McpToolExecutionFailed', MetricUnit.Count, 1);
        }

        // Create error message with appropriate context
        let errorMessage: string;
        if (error instanceof ToolExecutionError) {
            errorMessage = error.message;
        } else if (error instanceof McpToolExecutionError) {
            errorMessage = `MCP tool execution failed: ${error.message}`;
        } else {
            errorMessage = `Tool execution failed: ${error.message}`;
        }

        // Return error result with fallback response
        return {
            toolUseId,
            content: [{ text: `Error: ${errorMessage}` }],
            status: 'error',
        };
    }

    /**
     * Lists all available tools including both local and MCP tools.
     * 
     * Returns tool specifications in Bedrock API format for all tools
     * that can be invoked by the Agent. Local tools are included first,
     * followed by MCP tools.
     * 
     * @returns Promise resolving to array of tool specifications
     * 
     * @example
     * ```typescript
     * const allTools = await executor.listAllTools();
     * console.log(`Total tools available: ${allTools.length}`);
     * ```
     */
    async listAllTools(): Promise<ToolSpec[]> {
        const toolSpecs: ToolSpec[] = [];

        // Add local tools
        for (const tool of this.tools.values()) {
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

        // Add MCP tools if MCP Client Manager is available
        if (this.mcpClientManager) {
            try {
                const mcpTools = await this.mcpClientManager.listAllTools();

                // Convert MCP tools to ToolSpec format
                for (const mcpTool of mcpTools) {
                    // Skip if local tool with same name exists (local takes precedence)
                    if (this.tools.has(mcpTool.name)) {
                        this.logger.warn('Tool name conflict: local tool takes precedence', {
                            toolName: mcpTool.name,
                            mcpServer: mcpTool.serverName,
                        });
                        continue;
                    }

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

                this.logger.debug('Listed all tools', {
                    localToolCount: this.tools.size,
                    mcpToolCount: mcpTools.length,
                    totalToolCount: toolSpecs.length,
                });
            } catch (error) {
                this.logger.error('Failed to list MCP tools', {
                    error,
                });
                // Continue with just local tools
            }
        } else {
            this.logger.debug('Listed local tools only (no MCP manager)', {
                localToolCount: this.tools.size,
            });
        }

        return toolSpecs;
    }

    /**
     * Gets the list of registered local tool names.
     * 
     * @returns Array of local tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Checks if a tool is registered (local or MCP).
     * 
     * @param toolName - Name of the tool to check
     * @returns True if tool is registered, false otherwise
     */
    hasTool(toolName: string): boolean {
        return this.tools.has(toolName);
    }

    /**
     * Gets a local tool definition by name.
     * 
     * @param toolName - Name of the tool
     * @returns Tool definition or undefined if not found
     */
    getTool(toolName: string): ToolDefinition | undefined {
        return this.tools.get(toolName);
    }

    /**
     * Gets the count of registered local tools.
     * 
     * @returns Number of registered local tools
     */
    getToolCount(): number {
        return this.tools.size;
    }
}
