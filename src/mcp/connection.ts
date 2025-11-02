/**
 * MCP Server Connection implementation using HTTP Streamable transport.
 *
 * This module provides the McpServerConnection class that manages communication
 * with a single MCP server via HTTP Streamable transport protocol.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { Metrics } from '@aws-lambda-powertools/metrics';
import type { Tracer } from '@aws-lambda-powertools/tracer';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { RetryHandler } from '../utils/retry.js';
import {
    McpConnectionError,
    McpToolExecutionError,
    McpResourceError,
    ErrorCode,
} from '../errors/index.js';
import { filterTools } from './filters.js';
import type {
    McpServerConfig,
    McpTool,
    McpResource,
    ResourceContent,
    ConnectionStatus,
} from './types.js';

/**
 * Event handler type for connection state changes.
 */
type ConnectionEventHandler = (status: ConnectionStatus) => void;

/**
 * Manages connection to a single MCP server using HTTP Streamable transport.
 *
 * Handles connection lifecycle, tool operations, resource operations,
 * authentication, and automatic reconnection.
 *
 * @example
 * ```typescript
 * const connection = new McpServerConnection(config, logger);
 *
 * await connection.connect();
 *
 * const tools = await connection.listTools();
 * const result = await connection.callTool('get_weather', { city: 'Seattle' });
 *
 * await connection.disconnect();
 * ```
 */
export class McpServerConnection {
    private readonly config: McpServerConfig;
    private readonly logger: Logger;
    private readonly metrics: Metrics;
    private readonly tracer: Tracer;
    private client: Client | null = null;
    private transport: Transport | null = null;
    private status: ConnectionStatus = { state: 'disconnected' };
    private tools: Map<string, McpTool> = new Map();
    private resources: Map<string, McpResource> = new Map();
    private reconnectHandler: RetryHandler | null = null;
    private reconnectAttempts = 0;
    private eventHandlers: Map<string, ConnectionEventHandler[]> = new Map();

    /**
     * Create a new MCP server connection.
     *
     * @param config - MCP server configuration
     * @param logger - Logger instance for logging connection events
     * @param metrics - Metrics instance for tracking MCP operations
     * @param tracer - Tracer instance for distributed tracing
     */
    constructor(config: McpServerConfig, logger: Logger, metrics: Metrics, tracer: Tracer) {
        this.config = config;
        this.logger = logger.createChild({
            persistentLogAttributes: {
                mcpServer: config.name,
                mcpUrl: config.url,
            },
        });
        this.metrics = metrics;
        this.tracer = tracer;

        // Initialize reconnect handler if reconnection is enabled
        if (config.reconnect?.enabled !== false) {
            const reconnectConfig = config.reconnect || {};
            this.reconnectHandler = new RetryHandler(
                {
                    maxRetries: reconnectConfig.maxAttempts ?? 3,
                    baseDelay: reconnectConfig.baseDelay ?? 1000,
                    maxDelay: reconnectConfig.maxDelay ?? 30000,
                    retryableErrors: [
                        ErrorCode.API_TIMEOUT,
                        ErrorCode.API_INTERNAL_ERROR,
                        ErrorCode.API_ERROR,
                        ErrorCode.MCP_CONNECTION_ERROR,
                        ErrorCode.MCP_SERVER_UNAVAILABLE,
                    ],
                },
                this.logger,
            );
        }
    }

    /**
     * Establish connection to the MCP server.
     *
     * Initializes the HTTP Streamable transport, connects to the server,
     * and fetches available tools and resources.
     *
     * @throws {McpConnectionError} If connection fails
     */
    async connect(): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.info('Connecting to MCP server', {
                name: this.config.name,
                url: this.config.url,
            });

            // Add trace annotations
            this.tracer.putAnnotation('mcpServer', this.config.name);
            this.tracer.putAnnotation('mcpOperation', 'connect');

            // Build headers with authentication
            const headers = this.buildHeaders();

            // Create transport based on configuration
            const transportType = this.config.transport || 'sse'; // Default to SSE

            if (transportType === 'sse') {
                // Create SSE transport (standard MCP transport)
                this.transport = new SSEClientTransport(new URL(this.config.url), {
                    requestInit: {
                        headers,
                    },
                });
            } else {
                // Create HTTP Streamable transport
                this.transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
                    requestInit: {
                        headers,
                    },
                });
            }

            // Create MCP client
            this.client = new Client(
                {
                    name: 'bedrock-agent-framework',
                    version: '0.1.0',
                },
                {
                    capabilities: {},
                },
            );

            // Connect to the server with tracing
            await this.withSubsegment('McpConnect', async () => {
                await this.client!.connect(this.transport!);
            });

            // Update status
            this.status = {
                state: 'connected',
                connectedAt: new Date(),
            };

            const latency = Date.now() - startTime;

            this.logger.info('Successfully connected to MCP server', {
                name: this.config.name,
                latencyMs: latency,
            });

            // Emit metrics
            this.metrics.addMetric('McpConnectionSuccess', MetricUnit.Count, 1);
            this.metrics.addMetric('McpConnectionLatency', MetricUnit.Milliseconds, latency);

            // Fetch tools and resources
            await this.fetchToolsAndResources();

            // Reset reconnect attempts on successful connection
            this.resetReconnectAttempts();

            // Emit connected event
            this.emitEvent('connected', this.status);
        } catch (error) {
            const latency = Date.now() - startTime;

            const mcpError = new McpConnectionError(
                this.config.name,
                'Failed to connect to MCP server',
                error as Error,
            );

            this.logger.error('Failed to connect to MCP server', {
                error: mcpError,
                latencyMs: latency,
            });

            // Emit failure metrics
            this.metrics.addMetric('McpConnectionFailure', MetricUnit.Count, 1);
            this.metrics.addMetric('McpConnectionLatency', MetricUnit.Milliseconds, latency);

            this.status = {
                state: 'error',
                error: mcpError.message,
            };

            this.emitEvent('error', this.status);

            throw mcpError;
        }
    }

    /**
     * Disconnect from the MCP server.
     *
     * Closes the connection gracefully and cleans up resources.
     */
    async disconnect(): Promise<void> {
        try {
            this.logger.info('Disconnecting from MCP server', {
                name: this.config.name,
            });

            // Add trace annotations
            this.tracer.putAnnotation('mcpServer', this.config.name);
            this.tracer.putAnnotation('mcpOperation', 'disconnect');

            if (this.client) {
                await this.client.close();
                this.client = null;
            }

            if (this.transport) {
                await this.transport.close();
                this.transport = null;
            }

            this.status = { state: 'disconnected' };
            this.tools.clear();
            this.resources.clear();

            this.logger.info('Successfully disconnected from MCP server', {
                name: this.config.name,
            });

            // Emit metric
            this.metrics.addMetric('McpDisconnection', MetricUnit.Count, 1);

            this.emitEvent('disconnected', this.status);
        } catch (error) {
            this.logger.error('Error during disconnect', {
                error,
                serverName: this.config.name,
            });

            // Still mark as disconnected even if cleanup fails
            this.status = { state: 'disconnected' };
            this.emitEvent('disconnected', this.status);
        }
    }

    /**
     * Check if the connection is currently active.
     *
     * @returns true if connected, false otherwise
     */
    isConnected(): boolean {
        return this.status.state === 'connected' && this.client !== null;
    }

    /**
     * Get the current connection status.
     *
     * @returns Current connection status
     */
    getStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Get the server name.
     *
     * @returns Server name from configuration
     */
    getName(): string {
        return this.config.name;
    }

    /**
     * Build HTTP headers including authentication.
     *
     * @returns Headers object for HTTP requests
     */
    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add custom headers from config
        if (this.config.customHeaders) {
            Object.assign(headers, this.config.customHeaders);
        }

        // Add authentication headers
        if (this.config.authentication) {
            const auth = this.config.authentication;

            if (auth.type === 'bearer' && auth.token) {
                headers['Authorization'] = `Bearer ${auth.token}`;
            }

            if (auth.headers) {
                Object.assign(headers, auth.headers);
            }
        }

        return headers;
    }

    /**
     * Fetch tools and resources from the MCP server.
     *
     * Called after successful connection to populate tool and resource caches.
     */
    private async fetchToolsAndResources(): Promise<void> {
        try {
            // Fetch tools
            await this.refreshTools();

            // Fetch resources
            await this.refreshResources();

            this.logger.info('Fetched tools and resources from MCP server', {
                toolCount: this.tools.size,
                resourceCount: this.resources.size,
            });
        } catch (error) {
            this.logger.warn('Failed to fetch tools and resources', {
                error,
                serverName: this.config.name,
            });
            // Don't throw - connection is still valid even if discovery fails
        }
    }

    /**
     * Refresh the tool cache from the MCP server.
     */
    private async refreshTools(): Promise<void> {
        if (!this.client) {
            throw new McpConnectionError(this.config.name, 'Cannot refresh tools: not connected');
        }

        try {
            const response = await this.client.listTools();
            this.tools.clear();

            for (const tool of response.tools) {
                const mcpTool: McpTool = {
                    name: tool.name,
                    description: tool.description || '',
                    inputSchema: tool.inputSchema,
                    serverName: this.config.name,
                };

                this.tools.set(tool.name, mcpTool);
            }

            // Apply tool filtering
            this.applyToolFilters();

            this.logger.info('Successfully fetched tools from MCP server', {
                toolCount: this.tools.size,
                serverName: this.config.name,
            });
        } catch (error: any) {
            // Some MCP servers don't support listTools - this is okay
            // Tools can still be called dynamically
            this.logger.debug('listTools not supported by MCP server', {
                serverName: this.config.name,
                error: error.message,
            });
        }
    }

    /**
     * Apply tool filters based on configuration.
     */
    private applyToolFilters(): void {
        if (!this.config.toolFilter) {
            return;
        }

        // Convert Map to array for filtering
        const toolsArray = Array.from(this.tools.values());

        // Apply filtering using the filterTools utility
        const result = filterTools(toolsArray, this.config.toolFilter, this.logger);

        // Rebuild the tools Map with filtered results
        this.tools.clear();
        for (const tool of result.tools) {
            this.tools.set(tool.name, tool);
        }
    }

    /**
     * Refresh the resource cache from the MCP server.
     */
    private async refreshResources(): Promise<void> {
        if (!this.client) {
            throw new McpConnectionError(
                this.config.name,
                'Cannot refresh resources: not connected',
            );
        }

        try {
            const response = await this.client.listResources();
            this.resources.clear();

            for (const resource of response.resources) {
                const mcpResource: McpResource = {
                    uri: resource.uri,
                    name: resource.name,
                    description: resource.description,
                    mimeType: resource.mimeType,
                    serverName: this.config.name,
                };

                this.resources.set(resource.uri, mcpResource);
            }

            this.logger.info('Successfully fetched resources from MCP server', {
                resourceCount: this.resources.size,
                serverName: this.config.name,
            });
        } catch (error: any) {
            // Some MCP servers don't support listResources - this is okay
            this.logger.debug('listResources not supported by MCP server', {
                serverName: this.config.name,
                error: error.message,
            });
        }
    }

    /**
     * List all available tools from the MCP server.
     *
     * Returns cached tool definitions. Call refreshTools() to update the cache.
     *
     * @returns Array of tool definitions
     */
    listTools(): Promise<McpTool[]> {
        if (!this.isConnected()) {
            throw new McpConnectionError(this.config.name, 'Cannot list tools: not connected');
        }

        return Promise.resolve(Array.from(this.tools.values()));
    }

    /**
     * Execute a tool on the MCP server.
     *
     * @param name - Tool name
     * @param args - Tool input arguments
     * @returns Tool execution result
     * @throws {McpToolExecutionError} If tool execution fails
     */
    async callTool(name: string, args: any): Promise<any> {
        if (!this.isConnected() || !this.client) {
            throw new McpToolExecutionError(
                this.config.name,
                name,
                'Cannot call tool: not connected',
            );
        }

        if (!this.hasTool(name)) {
            throw new McpToolExecutionError(
                this.config.name,
                name,
                'Tool not found on this server',
            );
        }

        const startTime = Date.now();

        try {
            this.logger.info('Calling MCP tool', {
                toolName: name,
                serverName: this.config.name,
            });

            // Add trace annotations
            this.tracer.putAnnotation('mcpServer', this.config.name);
            this.tracer.putAnnotation('mcpTool', name);
            this.tracer.putAnnotation('mcpOperation', 'callTool');

            const response = await this.withSubsegment('McpToolCall', async () => {
                return await this.client!.callTool({
                    name,
                    arguments: args,
                });
            });

            const latency = Date.now() - startTime;

            this.logger.info('MCP tool call succeeded', {
                toolName: name,
                serverName: this.config.name,
                latencyMs: latency,
                hasContent:
                    response.content &&
                    Array.isArray(response.content) &&
                    response.content.length > 0,
            });

            // Emit metrics
            this.metrics.addMetric('McpToolCallSuccess', MetricUnit.Count, 1);
            this.metrics.addMetric('McpToolCallLatency', MetricUnit.Milliseconds, latency);

            // Extract content from response
            if (
                response.content &&
                Array.isArray(response.content) &&
                response.content.length > 0
            ) {
                // If single text content, return the text directly
                if (response.content.length === 1 && response.content[0].type === 'text') {
                    return response.content[0].text;
                }
                // Otherwise return the full content array
                return response.content;
            }

            return null;
        } catch (error) {
            const latency = Date.now() - startTime;

            const mcpError = new McpToolExecutionError(
                this.config.name,
                name,
                'Tool execution failed',
                error as Error,
            );

            this.logger.error('MCP tool execution failed', {
                error: mcpError,
                toolName: name,
                serverName: this.config.name,
                latencyMs: latency,
            });

            // Emit failure metrics
            this.metrics.addMetric('McpToolCallFailure', MetricUnit.Count, 1);
            this.metrics.addMetric('McpToolCallLatency', MetricUnit.Milliseconds, latency);

            throw mcpError;
        }
    }

    /**
     * Check if a tool is available on this server.
     *
     * @param name - Tool name
     * @returns true if tool is available, false otherwise
     */
    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * List all available resources from the MCP server.
     *
     * Returns cached resource definitions. Call refreshResources() to update the cache.
     *
     * @returns Array of resource definitions
     */
    listResources(): Promise<McpResource[]> {
        if (!this.isConnected()) {
            throw new McpConnectionError(this.config.name, 'Cannot list resources: not connected');
        }

        return Promise.resolve(Array.from(this.resources.values()));
    }

    /**
     * Read resource content from the MCP server.
     *
     * @param uri - Resource URI
     * @returns Resource content (text or blob)
     * @throws {McpResourceError} If resource read fails
     */
    async readResource(uri: string): Promise<ResourceContent> {
        if (!this.isConnected() || !this.client) {
            throw new McpResourceError(
                this.config.name,
                uri,
                'Cannot read resource: not connected',
            );
        }

        const startTime = Date.now();

        try {
            this.logger.info('Reading MCP resource', {
                uri,
                serverName: this.config.name,
            });

            // Add trace annotations
            this.tracer.putAnnotation('mcpServer', this.config.name);
            this.tracer.putAnnotation('mcpResource', uri);
            this.tracer.putAnnotation('mcpOperation', 'readResource');

            const response = await this.withSubsegment('McpResourceRead', async () => {
                return await this.client!.readResource({ uri });
            });

            const latency = Date.now() - startTime;

            this.logger.info('MCP resource read succeeded', {
                uri,
                serverName: this.config.name,
                latencyMs: latency,
                hasContent:
                    response.contents &&
                    Array.isArray(response.contents) &&
                    response.contents.length > 0,
            });

            // Emit metrics
            this.metrics.addMetric('McpResourceReadSuccess', MetricUnit.Count, 1);
            this.metrics.addMetric('McpResourceReadLatency', MetricUnit.Milliseconds, latency);

            // Process resource contents
            if (
                !response.contents ||
                !Array.isArray(response.contents) ||
                response.contents.length === 0
            ) {
                throw new McpResourceError(this.config.name, uri, 'Resource has no content');
            }

            // Get the first content item
            const content = response.contents[0] as any;
            const resourceContent: ResourceContent = {
                uri,
                mimeType: content.mimeType as string | undefined,
            };

            // Handle different content types
            if (content.type === 'text') {
                resourceContent.text = content.text as string;
            } else if (content.type === 'blob') {
                // Convert base64 blob to Uint8Array
                const base64Data = content.blob as string;
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                resourceContent.blob = bytes;
            }

            return resourceContent;
        } catch (error) {
            const latency = Date.now() - startTime;

            if (error instanceof McpResourceError) {
                // Emit failure metrics
                this.metrics.addMetric('McpResourceReadFailure', MetricUnit.Count, 1);
                this.metrics.addMetric('McpResourceReadLatency', MetricUnit.Milliseconds, latency);
                throw error;
            }

            const mcpError = new McpResourceError(
                this.config.name,
                uri,
                'Resource read failed',
                error as Error,
            );

            this.logger.error('MCP resource read failed', {
                error: mcpError,
                uri,
                serverName: this.config.name,
                latencyMs: latency,
            });

            // Emit failure metrics
            this.metrics.addMetric('McpResourceReadFailure', MetricUnit.Count, 1);
            this.metrics.addMetric('McpResourceReadLatency', MetricUnit.Milliseconds, latency);

            throw mcpError;
        }
    }

    /**
     * Attempt to reconnect to the MCP server.
     *
     * Uses exponential backoff strategy based on reconnection configuration.
     * Updates connection status and emits events during reconnection process.
     *
     * @returns Promise that resolves when reconnection succeeds
     * @throws {McpConnectionError} If reconnection fails after max attempts
     */
    async attemptReconnect(): Promise<void> {
        if (!this.shouldReconnect()) {
            throw new McpConnectionError(
                this.config.name,
                'Reconnection not allowed or max attempts exceeded',
            );
        }

        this.reconnectAttempts++;

        this.status = {
            state: 'reconnecting',
            attempt: this.reconnectAttempts,
        };

        this.logger.info('Attempting to reconnect to MCP server', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.config.reconnect?.maxAttempts ?? 3,
            serverName: this.config.name,
        });

        // Add trace annotations
        this.tracer.putAnnotation('mcpServer', this.config.name);
        this.tracer.putAnnotation('mcpOperation', 'reconnect');
        this.tracer.putAnnotation('reconnectAttempt', this.reconnectAttempts);

        // Emit metric
        this.metrics.addMetric('McpReconnectionAttempt', MetricUnit.Count, 1);

        this.emitEvent('reconnecting', this.status);

        try {
            // Clean up existing connection
            if (this.client) {
                try {
                    await this.client.close();
                } catch (error) {
                    // Ignore cleanup errors
                    this.logger.debug('Error closing client during reconnect', { error });
                }
                this.client = null;
            }

            if (this.transport) {
                try {
                    await this.transport.close();
                } catch (error) {
                    // Ignore cleanup errors
                    this.logger.debug('Error closing transport during reconnect', { error });
                }
                this.transport = null;
            }

            // Use retry handler if available
            if (this.reconnectHandler) {
                await this.reconnectHandler.executeWithRetry(
                    async () => await this.connect(),
                    `McpReconnect-${this.config.name}`,
                );
            } else {
                await this.connect();
            }

            this.logger.info('Successfully reconnected to MCP server', {
                attempt: this.reconnectAttempts,
                serverName: this.config.name,
            });

            // Emit success metric
            this.metrics.addMetric('McpReconnectionSuccess', MetricUnit.Count, 1);
        } catch (error) {
            this.logger.error('Reconnection attempt failed', {
                attempt: this.reconnectAttempts,
                serverName: this.config.name,
                error,
            });

            // Emit failure metric
            this.metrics.addMetric('McpReconnectionFailure', MetricUnit.Count, 1);

            // Check if we should try again
            if (this.shouldReconnect()) {
                // Calculate delay for next attempt
                const baseDelay = this.config.reconnect?.baseDelay ?? 1000;
                const maxDelay = this.config.reconnect?.maxDelay ?? 30000;
                const delay = Math.min(
                    baseDelay * Math.pow(2, this.reconnectAttempts - 1),
                    maxDelay,
                );

                this.logger.info('Will retry reconnection', {
                    nextAttempt: this.reconnectAttempts + 1,
                    delayMs: delay,
                    serverName: this.config.name,
                });

                // Schedule next reconnection attempt
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.attemptReconnect();
            } else {
                // Max attempts reached
                this.status = {
                    state: 'error',
                    error: 'Max reconnection attempts exceeded',
                };

                this.emitEvent('error', this.status);

                throw new McpConnectionError(
                    this.config.name,
                    'Failed to reconnect after max attempts',
                    error as Error,
                    { attempts: this.reconnectAttempts },
                );
            }
        }
    }

    /**
     * Check if reconnection should be attempted.
     *
     * Considers reconnection configuration and current attempt count.
     *
     * @returns true if reconnection should be attempted, false otherwise
     */
    shouldReconnect(): boolean {
        // Check if reconnection is enabled
        if (this.config.reconnect?.enabled === false) {
            return false;
        }

        // Check if we've exceeded max attempts
        const maxAttempts = this.config.reconnect?.maxAttempts ?? 3;
        if (maxAttempts > 0 && this.reconnectAttempts >= maxAttempts) {
            return false;
        }

        // Check if we're already connected
        if (this.isConnected()) {
            return false;
        }

        return true;
    }

    /**
     * Reset reconnection attempt counter.
     *
     * Called after successful connection or manual disconnect.
     */
    private resetReconnectAttempts(): void {
        this.reconnectAttempts = 0;
    }

    /**
     * Register an event handler for connection state changes.
     *
     * @param event - Event type ('connected', 'disconnected', 'reconnecting', 'error')
     * @param handler - Handler function to call when event occurs
     */
    on(
        event: 'connected' | 'disconnected' | 'reconnecting' | 'error',
        handler: ConnectionEventHandler,
    ): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    /**
     * Emit an event to all registered handlers.
     *
     * @param event - Event type
     * @param status - Current connection status
     */
    private emitEvent(event: string, status: ConnectionStatus): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(status);
                } catch (error) {
                    this.logger.error('Error in event handler', {
                        event,
                        error,
                    });
                }
            }
        }
    }

    /**
     * Execute an operation within a trace subsegment.
     *
     * @param name - Name of the subsegment
     * @param callback - Operation to execute
     * @returns Result of the operation
     */
    private async withSubsegment<T>(name: string, callback: () => Promise<T>): Promise<T> {
        const segment = this.tracer.getSegment();
        if (!segment) {
            // If no active segment, just execute the callback
            return callback();
        }

        const subsegment = segment.addNewSubsegment(name);

        try {
            const result = await callback();
            subsegment.close();
            return result;
        } catch (error) {
            subsegment.addError(error as Error);
            subsegment.close();
            throw error;
        }
    }
}
