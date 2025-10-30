/**
 * Model Context Protocol (MCP) type definitions for the Agent Bedrock.
 * 
 * This module contains interfaces and types for integrating with MCP servers
 * via HTTP Streamable transport. MCP servers provide external tools and resources
 * that can be dynamically attached to Agents.
 * 
 * @see https://modelcontextprotocol.io
 */

/**
 * Configuration for connecting to an MCP server.
 * 
 * MCP servers provide tools and resources that extend Agent capabilities.
 * Connections use HTTP Streamable transport for communication.
 * 
 * @example
 * ```typescript
 * const mcpConfig: McpServerConfig = {
 *   name: 'weather-service',
 *   url: 'https://weather-mcp.example.com/mcp',
 *   description: 'Weather data and forecasts',
 *   authentication: {
 *     type: 'bearer',
 *     token: process.env.WEATHER_API_TOKEN
 *   },
 *   reconnect: {
 *     enabled: true,
 *     maxAttempts: 5
 *   },
 *   toolFilter: {
 *     allowedTools: ['get_weather', 'get_forecast']
 *   }
 * };
 * ```
 */
export interface McpServerConfig {
    /**
     * Unique identifier for the MCP server.
     * Used to reference the server in Agent operations.
     * 
     * @example 'weather-service'
     * @example 'database-connector'
     */
    name: string;

    /**
     * HTTP endpoint URL for the MCP server.
     * Must use HTTP or HTTPS protocol.
     * 
     * @example 'https://mcp-server.example.com/mcp'
     * @example 'http://localhost:3000/mcp'
     */
    url: string;

    /**
     * Human-readable description of the MCP server's purpose.
     * Used for documentation and logging.
     */
    description?: string;

    /**
     * Authentication configuration for secured MCP servers.
     * If not provided, requests are sent without authentication.
     */
    authentication?: McpAuthConfig;

    /**
     * Automatic reconnection configuration.
     * Controls behavior when connection to MCP server fails.
     */
    reconnect?: McpReconnectConfig;

    /**
     * Tool filtering configuration.
     * Controls which tools from the MCP server are exposed to the Agent.
     */
    toolFilter?: McpToolFilter;

    /**
     * Custom HTTP headers to include in all requests to the MCP server.
     * Useful for API keys, tracking headers, or custom authentication.
     * 
     * @example { 'X-API-Key': 'abc123', 'X-Request-ID': 'xyz' }
     */
    customHeaders?: Record<string, string>;

    /**
     * Transport protocol to use for MCP communication.
     * 
     * - 'sse': Server-Sent Events (SSE) - Standard MCP transport using SSE for receiving messages
     * - 'streamable-http': HTTP Streamable transport - Alternative transport for streaming
     * 
     * @default 'sse'
     */
    transport?: 'sse' | 'streamable-http';
}

/**
 * Authentication configuration for MCP server connections.
 * 
 * Supports bearer token authentication and custom header-based authentication.
 */
export interface McpAuthConfig {
    /**
     * Authentication type.
     * 
     * - 'bearer': Uses Authorization header with Bearer token
     * - 'custom': Uses custom headers defined in headers property
     */
    type: 'bearer' | 'custom';

    /**
     * Bearer token for authentication.
     * Used when type is 'bearer'.
     * 
     * @example 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
     */
    token?: string;

    /**
     * Custom authentication headers.
     * Used when type is 'custom' or to supplement bearer authentication.
     * 
     * @example { 'X-API-Key': 'secret-key', 'X-Client-ID': 'client-123' }
     */
    headers?: Record<string, string>;
}

/**
 * Reconnection configuration for handling MCP server connection failures.
 * 
 * Implements exponential backoff strategy for automatic reconnection attempts.
 */
export interface McpReconnectConfig {
    /**
     * Enable automatic reconnection on connection failure.
     * 
     * @default true
     */
    enabled?: boolean;

    /**
     * Maximum number of reconnection attempts before marking server as unavailable.
     * Set to 0 for unlimited attempts (not recommended).
     * 
     * @minimum 0
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Base delay in milliseconds for exponential backoff.
     * First retry waits baseDelay ms, second waits baseDelay * 2 ms, etc.
     * 
     * @minimum 0
     * @default 1000
     */
    baseDelay?: number;

    /**
     * Maximum delay in milliseconds between reconnection attempts.
     * Caps the exponential backoff to prevent excessive wait times.
     * 
     * @minimum 0
     * @default 30000
     */
    maxDelay?: number;
}

/**
 * Tool filtering configuration for MCP servers.
 * 
 * Controls which tools from an MCP server are exposed to the Agent.
 * Useful for security, limiting capabilities, or avoiding tool conflicts.
 * 
 * @example
 * ```typescript
 * // Only allow specific tools
 * const filter1: McpToolFilter = {
 *   allowedTools: ['get_weather', 'get_forecast']
 * };
 * 
 * // Allow all except dangerous tools
 * const filter2: McpToolFilter = {
 *   deniedTools: ['delete_database', 'shutdown_server']
 * };
 * 
 * // Combine both (allowedTools applied first, then deniedTools)
 * const filter3: McpToolFilter = {
 *   allowedTools: ['get_*', 'list_*'],
 *   deniedTools: ['get_secrets']
 * };
 * ```
 */
export interface McpToolFilter {
    /**
     * Whitelist of allowed tool names.
     * If specified, only tools matching this list are exposed.
     * Applied before deniedTools filter.
     * 
     * Supports exact matches only (no wildcards in current implementation).
     */
    allowedTools?: string[];

    /**
     * Blacklist of denied tool names.
     * Tools matching this list are excluded from exposure.
     * Applied after allowedTools filter.
     * 
     * Supports exact matches only (no wildcards in current implementation).
     */
    deniedTools?: string[];
}

/**
 * Tool definition from an MCP server.
 * 
 * Represents a tool provided by an MCP server that can be invoked by the Agent.
 * Similar to local ToolDefinition but includes server reference.
 */
export interface McpTool {
    /**
     * Unique name for the tool.
     * Must be unique across all tools (local and MCP).
     */
    name: string;

    /**
     * Human-readable description of what the tool does.
     * Used by the model to decide when to invoke the tool.
     */
    description: string;

    /**
     * JSON Schema defining the tool's input parameters.
     * Follows JSON Schema specification.
     */
    inputSchema: any;

    /**
     * Name of the MCP server providing this tool.
     * Used to route tool execution to the correct server.
     */
    serverName: string;
}

/**
 * Resource definition from an MCP server.
 * 
 * Represents data or content provided by an MCP server that can be
 * accessed by the Agent to provide additional context.
 */
export interface McpResource {
    /**
     * Unique URI identifying the resource.
     * Format is server-specific but typically follows URI conventions.
     * 
     * @example 'file:///path/to/document.txt'
     * @example 'db://customers/12345'
     * @example 'https://api.example.com/data/item'
     */
    uri: string;

    /**
     * Human-readable name for the resource.
     */
    name: string;

    /**
     * Description of the resource content and purpose.
     */
    description?: string;

    /**
     * MIME type of the resource content.
     * 
     * @example 'text/plain'
     * @example 'application/json'
     * @example 'image/png'
     */
    mimeType?: string;

    /**
     * Name of the MCP server providing this resource.
     * Used to route resource requests to the correct server.
     */
    serverName: string;
}

/**
 * Content of a resource fetched from an MCP server.
 * 
 * Resources can contain either text or binary data.
 * The content type is indicated by which property is populated.
 */
export interface ResourceContent {
    /**
     * URI of the resource.
     * Matches the URI used to request the resource.
     */
    uri: string;

    /**
     * MIME type of the resource content.
     * 
     * @example 'text/plain'
     * @example 'application/json'
     * @example 'image/png'
     */
    mimeType?: string;

    /**
     * Text content of the resource.
     * Populated for text-based resources (text/*, application/json, etc.).
     */
    text?: string;

    /**
     * Binary content of the resource.
     * Populated for binary resources (images, PDFs, etc.).
     */
    blob?: Uint8Array;
}

/**
 * Information about a connected MCP server.
 * 
 * Provides status and metadata about an MCP server connection.
 * Used for monitoring and debugging MCP integrations.
 */
export interface McpServerInfo {
    /**
     * Unique identifier for the MCP server.
     */
    name: string;

    /**
     * HTTP endpoint URL for the MCP server.
     */
    url: string;

    /**
     * Current connection status.
     * 
     * - 'connected': Successfully connected and operational
     * - 'disconnected': Not connected (initial state or after disconnect)
     * - 'reconnecting': Attempting to reconnect after failure
     * - 'error': Connection failed and not retrying
     */
    status: 'connected' | 'disconnected' | 'reconnecting' | 'error';

    /**
     * Number of tools available from this MCP server.
     * Updated after successful connection and tool discovery.
     */
    toolCount: number;

    /**
     * Number of resources available from this MCP server.
     * Updated after successful connection and resource discovery.
     */
    resourceCount: number;

    /**
     * Timestamp of last successful connection.
     * Undefined if never connected.
     */
    lastConnected?: Date;

    /**
     * Error message if connection is in error state.
     * Provides details about connection failure.
     */
    error?: string;
}

/**
 * Connection status for an MCP server.
 * 
 * Discriminated union type that provides detailed status information
 * based on the current connection state.
 */
export type ConnectionStatus =
    | {
        /**
         * Server is connected and operational.
         */
        state: 'connected';

        /**
         * Timestamp when connection was established.
         */
        connectedAt: Date;
    }
    | {
        /**
         * Server is not connected.
         * This is the initial state or after explicit disconnect.
         */
        state: 'disconnected';
    }
    | {
        /**
         * Server is attempting to reconnect after a failure.
         */
        state: 'reconnecting';

        /**
         * Current reconnection attempt number.
         * Starts at 1 for first retry.
         */
        attempt: number;
    }
    | {
        /**
         * Server connection failed and is not retrying.
         */
        state: 'error';

        /**
         * Error message describing the failure.
         */
        error: string;
    };
