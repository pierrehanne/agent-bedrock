/**
 * Tool-related type definitions for the Agent Bedrock.
 *
 * This module contains interfaces and types for defining and executing
 * tools that Agents can invoke during conversations.
 */

/**
 * Definition of a tool that can be invoked by the Agent.
 *
 * @example
 * ```typescript
 * const weatherTool: ToolDefinition = {
 *   name: 'get_weather',
 *   description: 'Get current weather for a location',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' }
 *     },
 *     required: ['location']
 *   },
 *   handler: async (input) => {
 *     return await weatherAPI.get(input.location);
 *   }
 * };
 * ```
 */
export interface ToolDefinition {
    /**
     * Unique name for the tool.
     * Must be alphanumeric with underscores.
     */
    name: string;

    /**
     * Human-readable description of what the tool does.
     * Used by the model to decide when to invoke the tool.
     */
    description: string;

    /**
     * JSON Schema defining the tool's input parameters.
     */
    inputSchema: JSONSchema;

    /**
     * Async function that executes the tool logic.
     *
     * @param input - Tool input matching the inputSchema
     * @returns Promise resolving to tool output
     */
    handler: (input: any) => Promise<any>;
}

/**
 * JSON Schema definition for tool inputs.
 * Follows JSON Schema Draft 7 specification.
 */
export interface JSONSchema {
    /**
     * Schema type (typically 'object' for tool inputs).
     */
    type: string;

    /**
     * Object properties definition.
     */
    properties?: Record<string, JSONSchemaProperty>;

    /**
     * Array of required property names.
     */
    required?: string[];

    /**
     * Additional schema properties.
     */
    [key: string]: any;
}

/**
 * JSON Schema property definition.
 */
export interface JSONSchemaProperty {
    /**
     * Property type.
     */
    type: string;

    /**
     * Property description.
     */
    description?: string;

    /**
     * Enum values for the property.
     */
    enum?: any[];

    /**
     * Items schema for array types.
     */
    items?: JSONSchemaProperty;

    /**
     * Additional property attributes.
     */
    [key: string]: any;
}

/**
 * Tool configuration for Bedrock API requests.
 */
export interface ToolConfig {
    /**
     * Array of tool specifications.
     */
    tools: ToolSpec[];

    /**
     * Strategy for tool selection.
     */
    toolChoice?: ToolChoice;
}

/**
 * Tool specification in Bedrock API format.
 */
export interface ToolSpec {
    toolSpec: {
        /**
         * Tool name.
         */
        name: string;

        /**
         * Tool description.
         */
        description: string;

        /**
         * Input schema wrapped in json property.
         */
        inputSchema: {
            json: JSONSchema;
        };
    };
}

/**
 * Tool choice strategy for model tool selection.
 */
export type ToolChoice =
    | { auto: Record<string, never> } // Model decides when to use tools
    | { any: Record<string, never> } // Model must use a tool
    | { tool: { name: string } }; // Model must use specific tool

/**
 * Tool use request from the model.
 */
export interface ToolUse {
    /**
     * Unique identifier for this tool use.
     */
    toolUseId: string;

    /**
     * Name of the tool to invoke.
     */
    name: string;

    /**
     * Input parameters for the tool.
     */
    input: any;
}

/**
 * Result of a tool execution.
 */
export interface ToolResult {
    /**
     * Identifier matching the tool use request.
     */
    toolUseId: string;

    /**
     * Result content.
     */
    content: Array<{ text: string }>;

    /**
     * Execution status.
     */
    status: 'success' | 'error';
}
