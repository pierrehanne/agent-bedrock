/**
 * MCP Client Manager implementation for managing multiple MCP server connections.
 * 
 * This module provides the McpClientManager class that coordinates connections
 * to multiple MCP servers and aggregates their tools and resources.
 */

import type { Logger } from '@aws-lambda-powertools/logger';
import type { Metrics } from '@aws-lambda-powertools/metrics';
import type { Tracer } from '@aws-lambda-powertools/tracer';
import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { McpServerConnection } from './connection.js';
import { McpToolExecutionError, McpResourceError } from '../errors/index.js';
import type {
    McpServerConfig,
    McpServerInfo,
    McpTool,
    McpResource,
    ResourceContent,
} from './types.js';

/**
 * Manages connections to multiple MCP servers.
 * 
 * Provides centralized management of MCP server connections, tool aggregation,
 * and resource access across multiple servers.
 * 
 * @example
 * ```typescript
 * const manager = new McpClientManager(logger, metrics);
 * 
 * // Connect to multiple servers
 * await manager.connect({
 *   name: 'weather',
 *   url: 'https://weather-mcp.example.com/mcp'
 * });
 * 
 * await manager.connect({
 *   name: 'database',
 *   url: 'https://db-mcp.example.com/mcp'
 * });
 * 
 * // List all tools from all servers
 * const tools = await manager.listAllTools();
 * 
 * // Execute a tool (automatically routed to correct server)
 * const result = await manager.executeTool('get_weather', { city: 'Seattle' });
 * 
 * // Clean up
 * await manager.close();
 * ```
 */
export class McpClientManager {
    private readonly connections: Map<string, McpServerConnection>;
    private readonly logger: Logger;
    private readonly metrics: Metrics;
    private readonly tracer: Tracer;

    /**
     * Create a new MCP Client Manager.
     * 
     * @param logger - Logger instance for logging manager operations
     * @param metrics - Metrics instance for tracking MCP operations
     * @param tracer - Tracer instance for distributed tracing
     */
    constructor(logger: Logger, metrics: Metrics, tracer: Tracer) {
        this.logger = logger.createChild({
            persistentLogAttributes: {
                component: 'McpClientManager',
            },
        });
        this.metrics = metrics;
        this.tracer = tracer;
        this.connections = new Map();

        this.logger.debug('McpClientManager initialized');
    }

    /**
     * Connect to an MCP server.
     * 
     * Creates a new connection to the specified MCP server and adds it to the
     * connection registry. If a connection with the same name already exists,
     * throws an error.
     * 
     * @param config - MCP server configuration
     * @throws {Error} If a connection with the same name already exists
     * @throws {McpConnectionError} If connection to the server fails
     */
    async connect(config: McpServerConfig): Promise<void> {
        // Validate that connection name is unique
        if (this.connections.has(config.name)) {
            const error = new Error(
                `MCP server with name '${config.name}' is already connected`
            );
            this.logger.error('Duplicate MCP server name', {
                serverName: config.name,
                error,
            });
            throw error;
        }

        this.logger.info('Connecting to MCP server', {
            serverName: config.name,
            url: config.url,
        });

        try {
            // Create new connection
            const connection = new McpServerConnection(config, this.logger, this.metrics, this.tracer);

            // Attempt to connect
            await connection.connect();

            // Add to registry
            this.connections.set(config.name, connection);

            // Emit metrics
            this.metrics.addMetric('McpServerConnected', MetricUnit.Count, 1);
            this.metrics.addMetric('McpServerCount', MetricUnit.Count, this.connections.size);

            this.logger.info('Successfully connected to MCP server', {
                serverName: config.name,
                totalConnections: this.connections.size,
            });
        } catch (error) {
            this.logger.error('Failed to connect to MCP server', {
                serverName: config.name,
                error,
            });

            // Emit failure metric
            this.metrics.addMetric('McpServerConnectionFailed', MetricUnit.Count, 1);

            throw error;
        }
    }

    /**
     * Disconnect from an MCP server.
     * 
     * Closes the connection to the specified MCP server and removes it from
     * the connection registry.
     * 
     * @param name - Name of the MCP server to disconnect
     * @throws {Error} If no connection with the specified name exists
     */
    async disconnect(name: string): Promise<void> {
        const connection = this.connections.get(name);

        if (!connection) {
            const error = new Error(
                `No MCP server connection found with name '${name}'`
            );
            this.logger.error('Cannot disconnect: server not found', {
                serverName: name,
                error,
            });
            throw error;
        }

        this.logger.info('Disconnecting from MCP server', {
            serverName: name,
        });

        try {
            // Disconnect from server
            await connection.disconnect();

            // Remove from registry
            this.connections.delete(name);

            // Emit metrics
            this.metrics.addMetric('McpServerDisconnected', MetricUnit.Count, 1);
            this.metrics.addMetric('McpServerCount', MetricUnit.Count, this.connections.size);

            this.logger.info('Successfully disconnected from MCP server', {
                serverName: name,
                remainingConnections: this.connections.size,
            });
        } catch (error) {
            this.logger.error('Error during MCP server disconnect', {
                serverName: name,
                error,
            });

            // Still remove from registry even if disconnect fails
            this.connections.delete(name);

            throw error;
        }
    }

    /**
     * Get a connection by name.
     * 
     * @param name - Name of the MCP server
     * @returns Connection instance, or undefined if not found
     */
    getConnection(name: string): McpServerConnection | undefined {
        return this.connections.get(name);
    }

    /**
     * List all connected MCP servers.
     * 
     * Returns information about all currently connected MCP servers including
     * their status, tool count, and resource count.
     * 
     * @returns Array of server information objects
     */
    listConnections(): McpServerInfo[] {
        const serverInfos: McpServerInfo[] = [];

        for (const [name, connection] of this.connections) {
            const status = connection.getStatus();

            // Build server info based on connection status
            const info: McpServerInfo = {
                name,
                url: '', // URL is not exposed from connection, would need config access
                status: status.state,
                toolCount: 0,
                resourceCount: 0,
            };

            // Add status-specific fields
            if (status.state === 'connected') {
                info.lastConnected = status.connectedAt;

                // Get tool and resource counts synchronously for connected servers
                try {
                    // These methods return cached values, so they're safe to call
                    connection.listTools().then(tools => {
                        info.toolCount = tools.length;
                    }).catch(() => {
                        // Keep count at 0 on error
                    });

                    connection.listResources().then(resources => {
                        info.resourceCount = resources.length;
                    }).catch(() => {
                        // Keep count at 0 on error
                    });
                } catch (error) {
                    // Ignore errors, keep counts at 0
                }
            } else if (status.state === 'error') {
                info.error = status.error;
            }

            serverInfos.push(info);
        }

        return serverInfos;
    }

    /**
     * Close all MCP server connections.
     * 
     * Disconnects from all MCP servers and clears the connection registry.
     * Should be called when the Agent is being disposed.
     */
    async close(): Promise<void> {
        this.logger.info('Closing all MCP server connections', {
            connectionCount: this.connections.size,
        });

        const disconnectPromises: Promise<void>[] = [];

        // Disconnect from all servers
        for (const [name, connection] of this.connections) {
            disconnectPromises.push(
                connection.disconnect().catch(error => {
                    this.logger.error('Error disconnecting from MCP server', {
                        serverName: name,
                        error,
                    });
                    // Don't throw, continue with other disconnects
                })
            );
        }

        // Wait for all disconnects to complete
        await Promise.all(disconnectPromises);

        // Clear registry
        this.connections.clear();

        // Emit metrics
        this.metrics.addMetric('McpServerCount', MetricUnit.Count, 0);

        this.logger.info('All MCP server connections closed');
    }

    /**
     * List all tools from all connected MCP servers.
     * 
     * Aggregates tools from all connected servers. If multiple servers provide
     * tools with the same name, a warning is logged but all tools are included.
     * 
     * @returns Array of all available MCP tools
     */
    async listAllTools(): Promise<McpTool[]> {
        const allTools: McpTool[] = [];
        const toolNames = new Set<string>();

        this.logger.debug('Listing all tools from MCP servers', {
            serverCount: this.connections.size,
        });

        // Collect tools from all connected servers
        for (const [name, connection] of this.connections) {
            // Skip servers that aren't connected
            if (!connection.isConnected()) {
                this.logger.debug('Skipping disconnected MCP server', {
                    serverName: name,
                });
                continue;
            }

            try {
                const tools = await connection.listTools();

                // Check for tool name conflicts
                for (const tool of tools) {
                    if (toolNames.has(tool.name)) {
                        this.logger.warn('Tool name conflict detected', {
                            toolName: tool.name,
                            serverName: name,
                            message: 'Multiple MCP servers provide a tool with the same name',
                        });
                    }
                    toolNames.add(tool.name);
                    allTools.push(tool);
                }

                this.logger.debug('Listed tools from MCP server', {
                    serverName: name,
                    toolCount: tools.length,
                });
            } catch (error) {
                this.logger.error('Failed to list tools from MCP server', {
                    serverName: name,
                    error,
                });
                // Continue with other servers
            }
        }

        this.logger.debug('Listed all MCP tools', {
            totalTools: allTools.length,
            uniqueNames: toolNames.size,
        });

        return allTools;
    }

    /**
     * Find which MCP server provides a specific tool.
     * 
     * Searches all connected servers to find which one provides the specified tool.
     * If multiple servers provide the same tool, returns the first match found.
     * 
     * @param toolName - Name of the tool to find
     * @returns Connection to the server providing the tool, or undefined if not found
     */
    findToolServer(toolName: string): McpServerConnection | undefined {
        this.logger.debug('Finding server for tool', {
            toolName,
        });

        for (const [name, connection] of this.connections) {
            // Skip servers that aren't connected
            if (!connection.isConnected()) {
                continue;
            }

            // Check if this server has the tool
            if (connection.hasTool(toolName)) {
                this.logger.debug('Found tool on MCP server', {
                    toolName,
                    serverName: name,
                });
                return connection;
            }
        }

        this.logger.debug('Tool not found on any MCP server', {
            toolName,
        });

        return undefined;
    }

    /**
     * Execute a tool on the appropriate MCP server.
     * 
     * Automatically routes the tool call to the correct MCP server based on
     * which server provides the tool.
     * 
     * @param toolName - Name of the tool to execute
     * @param input - Tool input arguments
     * @returns Tool execution result
     * @throws {McpToolExecutionError} If tool is not found or execution fails
     */
    async executeTool(toolName: string, input: any): Promise<any> {
        this.logger.debug('Executing MCP tool', {
            toolName,
            input,
        });

        // Find which server provides this tool
        const connection = this.findToolServer(toolName);

        if (!connection) {
            const error = new McpToolExecutionError(
                'unknown',
                toolName,
                'Tool not found on any connected MCP server'
            );

            this.logger.error('Cannot execute tool: not found', {
                toolName,
                error,
            });

            // Emit metric
            this.metrics.addMetric('McpToolNotFound', MetricUnit.Count, 1);

            throw error;
        }

        try {
            // Record start time for latency metric
            const startTime = Date.now();

            // Execute tool on the server
            const result = await connection.callTool(toolName, input);

            // Calculate latency
            const latency = Date.now() - startTime;

            // Emit metrics
            this.metrics.addMetric('McpToolExecutionSuccess', MetricUnit.Count, 1);
            this.metrics.addMetric('McpToolExecutionLatency', MetricUnit.Milliseconds, latency);

            this.logger.debug('MCP tool execution succeeded', {
                toolName,
                serverName: connection.getName(),
                latencyMs: latency,
            });

            return result;
        } catch (error) {
            this.logger.error('MCP tool execution failed', {
                toolName,
                serverName: connection.getName(),
                error,
            });

            // Emit metric
            this.metrics.addMetric('McpToolExecutionFailed', MetricUnit.Count, 1);

            throw error;
        }
    }

    /**
     * List all resources from all connected MCP servers.
     * 
     * Aggregates resources from all connected servers.
     * 
     * @returns Array of all available MCP resources
     */
    async listAllResources(): Promise<McpResource[]> {
        const allResources: McpResource[] = [];

        this.logger.debug('Listing all resources from MCP servers', {
            serverCount: this.connections.size,
        });

        // Collect resources from all connected servers
        for (const [name, connection] of this.connections) {
            // Skip servers that aren't connected
            if (!connection.isConnected()) {
                this.logger.debug('Skipping disconnected MCP server', {
                    serverName: name,
                });
                continue;
            }

            try {
                const resources = await connection.listResources();
                allResources.push(...resources);

                this.logger.debug('Listed resources from MCP server', {
                    serverName: name,
                    resourceCount: resources.length,
                });
            } catch (error) {
                this.logger.error('Failed to list resources from MCP server', {
                    serverName: name,
                    error,
                });
                // Continue with other servers
            }
        }

        this.logger.debug('Listed all MCP resources', {
            totalResources: allResources.length,
        });

        return allResources;
    }

    /**
     * Get resource content from the appropriate MCP server.
     * 
     * Parses the resource URI to determine which server provides the resource,
     * then fetches the content from that server.
     * 
     * The URI format is expected to include the server name as a prefix or
     * the method will search all servers for a matching resource URI.
     * 
     * @param uri - Resource URI
     * @returns Resource content (text or blob)
     * @throws {McpResourceError} If resource is not found or fetch fails
     */
    async getResource(uri: string): Promise<ResourceContent> {
        this.logger.debug('Fetching MCP resource', {
            uri,
        });

        // Try to find which server has this resource
        // We'll search all connected servers for a matching URI
        for (const [name, connection] of this.connections) {
            // Skip servers that aren't connected
            if (!connection.isConnected()) {
                continue;
            }

            try {
                // Try to list resources and find matching URI
                const resources = await connection.listResources();
                const hasResource = resources.some(r => r.uri === uri);

                if (hasResource) {
                    this.logger.debug('Found resource on MCP server', {
                        uri,
                        serverName: name,
                    });

                    // Fetch the resource content
                    const content = await connection.readResource(uri);

                    // Emit metric
                    this.metrics.addMetric('McpResourceFetchSuccess', MetricUnit.Count, 1);

                    this.logger.debug('MCP resource fetch succeeded', {
                        uri,
                        serverName: name,
                        hasText: !!content.text,
                        hasBlob: !!content.blob,
                    });

                    return content;
                }
            } catch (error) {
                this.logger.debug('Error checking resource on server', {
                    uri,
                    serverName: name,
                    error,
                });
                // Continue checking other servers
            }
        }

        // Resource not found on any server
        const error = new McpResourceError(
            'unknown',
            uri,
            'Resource not found on any connected MCP server'
        );

        this.logger.error('Cannot fetch resource: not found', {
            uri,
            error,
        });

        // Emit metric
        this.metrics.addMetric('McpResourceNotFound', MetricUnit.Count, 1);

        throw error;
    }
}
