/**
 * Input validation module for the Agent Bedrock.
 * 
 * This module provides comprehensive validation for all configuration
 * and input types to ensure data integrity before API calls.
 */

import { ValidationError } from '../errors/index.js';
import type { AgentConfig, ModelConfig } from './types.js';
import type { ConverseInput, ContentBlock } from './message-types.js';
import type { ToolDefinition } from '../tools/types.js';
import type { McpServerConfig } from '../mcp/types.js';

/**
 * Static utility class for validating inputs and configurations.
 * 
 * All validation methods throw ValidationError on failure with
 * descriptive error messages.
 */
export class InputValidator {
    /**
     * Validates AgentConfig to ensure all required fields are present
     * and all values are valid.
     * 
     * @param config - Agent configuration to validate
     * @throws {ValidationError} If validation fails
     * 
     * @example
     * ```typescript
     * InputValidator.validateAgentConfig({
     *   name: 'my-agent',
     *   modelId: 'anthropic.claude-3-sonnet-20240229-v1:0'
     * });
     * ```
     */
    static validateAgentConfig(config: AgentConfig): void {
        if (!config) {
            throw new ValidationError(
                'Agent configuration is required',
                { field: 'config' }
            );
        }

        // Validate required fields
        if (!config.name || typeof config.name !== 'string') {
            throw new ValidationError(
                'Agent name is required and must be a non-empty string',
                { field: 'name', value: config.name }
            );
        }

        if (config.name.trim().length === 0) {
            throw new ValidationError(
                'Agent name cannot be empty or whitespace only',
                { field: 'name', value: config.name }
            );
        }

        if (!config.modelId || typeof config.modelId !== 'string') {
            throw new ValidationError(
                'Model ID is required and must be a non-empty string',
                { field: 'modelId', value: config.modelId }
            );
        }

        if (config.modelId.trim().length === 0) {
            throw new ValidationError(
                'Model ID cannot be empty or whitespace only',
                { field: 'modelId', value: config.modelId }
            );
        }

        // Validate optional fields if provided
        if (config.region !== undefined && typeof config.region !== 'string') {
            throw new ValidationError(
                'Region must be a string',
                { field: 'region', value: config.region }
            );
        }

        if (config.description !== undefined && typeof config.description !== 'string') {
            throw new ValidationError(
                'Description must be a string',
                { field: 'description', value: config.description }
            );
        }

        if (config.streaming !== undefined && typeof config.streaming !== 'boolean') {
            throw new ValidationError(
                'Streaming must be a boolean',
                { field: 'streaming', value: config.streaming }
            );
        }

        if (config.enableMetrics !== undefined && typeof config.enableMetrics !== 'boolean') {
            throw new ValidationError(
                'enableMetrics must be a boolean',
                { field: 'enableMetrics', value: config.enableMetrics }
            );
        }

        if (config.enableTracing !== undefined && typeof config.enableTracing !== 'boolean') {
            throw new ValidationError(
                'enableTracing must be a boolean',
                { field: 'enableTracing', value: config.enableTracing }
            );
        }

        // Validate nested configurations
        if (config.modelConfig) {
            this.validateModelConfig(config.modelConfig);
        }

        if (config.guardrail) {
            this.validateGuardrailConfig(config.guardrail);
        }

        if (config.memory) {
            this.validateMemoryConfig(config.memory);
        }

        if (config.tools) {
            if (!Array.isArray(config.tools)) {
                throw new ValidationError(
                    'Tools must be an array',
                    { field: 'tools', value: typeof config.tools }
                );
            }

            config.tools.forEach((tool, index) => {
                try {
                    this.validateToolDefinition(tool);
                } catch (error) {
                    if (error instanceof ValidationError) {
                        throw new ValidationError(
                            `Tool at index ${index} is invalid: ${error.message}`,
                            { field: 'tools', index, originalError: error.message }
                        );
                    }
                    throw error;
                }
            });
        }

        if (config.mcpServers) {
            if (!Array.isArray(config.mcpServers)) {
                throw new ValidationError(
                    'MCP servers must be an array',
                    { field: 'mcpServers', value: typeof config.mcpServers }
                );
            }

            config.mcpServers.forEach((server, index) => {
                try {
                    this.validateMcpServerConfig(server);
                } catch (error) {
                    if (error instanceof ValidationError) {
                        throw new ValidationError(
                            `MCP server at index ${index} is invalid: ${error.message}`,
                            { field: 'mcpServers', index, originalError: error.message }
                        );
                    }
                    throw error;
                }
            });
        }
    }

    /**
     * Validates ModelConfig parameters to ensure they are within valid ranges.
     * 
     * @param config - Model configuration to validate
     * @throws {ValidationError} If validation fails
     */
    static validateModelConfig(config: ModelConfig): void {
        if (!config) {
            throw new ValidationError(
                'Model configuration cannot be null or undefined',
                { field: 'modelConfig' }
            );
        }

        if (config.temperature !== undefined) {
            if (typeof config.temperature !== 'number') {
                throw new ValidationError(
                    'Temperature must be a number',
                    { field: 'modelConfig.temperature', value: config.temperature }
                );
            }

            if (config.temperature < 0 || config.temperature > 1) {
                throw new ValidationError(
                    'Temperature must be between 0 and 1',
                    { field: 'modelConfig.temperature', value: config.temperature }
                );
            }
        }

        if (config.maxTokens !== undefined) {
            if (typeof config.maxTokens !== 'number') {
                throw new ValidationError(
                    'maxTokens must be a number',
                    { field: 'modelConfig.maxTokens', value: config.maxTokens }
                );
            }

            if (!Number.isInteger(config.maxTokens) || config.maxTokens < 1) {
                throw new ValidationError(
                    'maxTokens must be a positive integer',
                    { field: 'modelConfig.maxTokens', value: config.maxTokens }
                );
            }
        }

        if (config.topP !== undefined) {
            if (typeof config.topP !== 'number') {
                throw new ValidationError(
                    'topP must be a number',
                    { field: 'modelConfig.topP', value: config.topP }
                );
            }

            if (config.topP < 0 || config.topP > 1) {
                throw new ValidationError(
                    'topP must be between 0 and 1',
                    { field: 'modelConfig.topP', value: config.topP }
                );
            }
        }

        if (config.stopSequences !== undefined) {
            if (!Array.isArray(config.stopSequences)) {
                throw new ValidationError(
                    'stopSequences must be an array',
                    { field: 'modelConfig.stopSequences', value: typeof config.stopSequences }
                );
            }

            config.stopSequences.forEach((seq, index) => {
                if (typeof seq !== 'string') {
                    throw new ValidationError(
                        `Stop sequence at index ${index} must be a string`,
                        { field: 'modelConfig.stopSequences', index, value: typeof seq }
                    );
                }
            });
        }
    }

    /**
     * Validates ConverseInput to ensure message is properly formatted.
     * 
     * @param input - Conversation input to validate
     * @throws {ValidationError} If validation fails
     */
    static validateConverseInput(input: ConverseInput): void {
        if (!input) {
            throw new ValidationError(
                'Converse input is required',
                { field: 'input' }
            );
        }

        if (input.message === undefined || input.message === null) {
            throw new ValidationError(
                'Message is required',
                { field: 'message' }
            );
        }

        // Validate message content
        if (typeof input.message === 'string') {
            if (input.message.trim().length === 0) {
                throw new ValidationError(
                    'Message cannot be empty or whitespace only',
                    { field: 'message' }
                );
            }
        } else if (Array.isArray(input.message)) {
            if (input.message.length === 0) {
                throw new ValidationError(
                    'Message content blocks array cannot be empty',
                    { field: 'message' }
                );
            }

            input.message.forEach((block, index) => {
                try {
                    this.validateContentBlock(block);
                } catch (error) {
                    if (error instanceof ValidationError) {
                        throw new ValidationError(
                            `Content block at index ${index} is invalid: ${error.message}`,
                            { field: 'message', index, originalError: error.message }
                        );
                    }
                    throw error;
                }
            });
        } else {
            throw new ValidationError(
                'Message must be a string or array of content blocks',
                { field: 'message', value: typeof input.message }
            );
        }

        // Validate optional fields
        if (input.sessionId !== undefined) {
            if (typeof input.sessionId !== 'string') {
                throw new ValidationError(
                    'sessionId must be a string',
                    { field: 'sessionId', value: typeof input.sessionId }
                );
            }

            if (input.sessionId.trim().length === 0) {
                throw new ValidationError(
                    'sessionId cannot be empty or whitespace only',
                    { field: 'sessionId' }
                );
            }
        }

        if (input.systemPrompts !== undefined) {
            if (!Array.isArray(input.systemPrompts)) {
                throw new ValidationError(
                    'systemPrompts must be an array',
                    { field: 'systemPrompts', value: typeof input.systemPrompts }
                );
            }

            input.systemPrompts.forEach((prompt, index) => {
                if (typeof prompt !== 'string') {
                    throw new ValidationError(
                        `System prompt at index ${index} must be a string`,
                        { field: 'systemPrompts', index, value: typeof prompt }
                    );
                }

                if (prompt.trim().length === 0) {
                    throw new ValidationError(
                        `System prompt at index ${index} cannot be empty or whitespace only`,
                        { field: 'systemPrompts', index }
                    );
                }
            });
        }

        if (input.additionalContext !== undefined) {
            if (typeof input.additionalContext !== 'object' || input.additionalContext === null || Array.isArray(input.additionalContext)) {
                throw new ValidationError(
                    'additionalContext must be an object',
                    { field: 'additionalContext', value: typeof input.additionalContext }
                );
            }
        }
    }

    /**
     * Validates ToolDefinition to ensure it has all required properties
     * and valid schema.
     * 
     * @param tool - Tool definition to validate
     * @throws {ValidationError} If validation fails
     */
    static validateToolDefinition(tool: ToolDefinition): void {
        if (!tool) {
            throw new ValidationError(
                'Tool definition is required',
                { field: 'tool' }
            );
        }

        // Validate name
        if (!tool.name || typeof tool.name !== 'string') {
            throw new ValidationError(
                'Tool name is required and must be a non-empty string',
                { field: 'tool.name', value: tool.name }
            );
        }

        if (tool.name.trim().length === 0) {
            throw new ValidationError(
                'Tool name cannot be empty or whitespace only',
                { field: 'tool.name' }
            );
        }

        // Validate name format (alphanumeric and underscores only)
        if (!/^[a-zA-Z0-9_]+$/.test(tool.name)) {
            throw new ValidationError(
                'Tool name must contain only alphanumeric characters and underscores',
                { field: 'tool.name', value: tool.name }
            );
        }

        // Validate description
        if (!tool.description || typeof tool.description !== 'string') {
            throw new ValidationError(
                'Tool description is required and must be a non-empty string',
                { field: 'tool.description', value: tool.description }
            );
        }

        if (tool.description.trim().length === 0) {
            throw new ValidationError(
                'Tool description cannot be empty or whitespace only',
                { field: 'tool.description' }
            );
        }

        // Validate inputSchema
        if (!tool.inputSchema) {
            throw new ValidationError(
                'Tool inputSchema is required',
                { field: 'tool.inputSchema' }
            );
        }

        if (typeof tool.inputSchema !== 'object' || Array.isArray(tool.inputSchema)) {
            throw new ValidationError(
                'Tool inputSchema must be an object',
                { field: 'tool.inputSchema', value: typeof tool.inputSchema }
            );
        }

        if (!tool.inputSchema.type) {
            throw new ValidationError(
                'Tool inputSchema must have a type property',
                { field: 'tool.inputSchema.type' }
            );
        }

        if (typeof tool.inputSchema.type !== 'string') {
            throw new ValidationError(
                'Tool inputSchema type must be a string',
                { field: 'tool.inputSchema.type', value: typeof tool.inputSchema.type }
            );
        }

        // Validate handler
        if (!tool.handler) {
            throw new ValidationError(
                'Tool handler is required',
                { field: 'tool.handler' }
            );
        }

        if (typeof tool.handler !== 'function') {
            throw new ValidationError(
                'Tool handler must be a function',
                { field: 'tool.handler', value: typeof tool.handler }
            );
        }
    }

    /**
     * Validates McpServerConfig to ensure all required fields are present
     * and all values are valid.
     * 
     * @param config - MCP server configuration to validate
     * @throws {ValidationError} If validation fails
     * 
     * @example
     * ```typescript
     * InputValidator.validateMcpServerConfig({
     *   name: 'weather-service',
     *   url: 'https://weather-mcp.example.com/mcp'
     * });
     * ```
     */
    static validateMcpServerConfig(config: McpServerConfig): void {
        if (!config) {
            throw new ValidationError(
                'MCP server configuration is required',
                { field: 'config' }
            );
        }

        // Validate required fields
        if (!config.name || typeof config.name !== 'string') {
            throw new ValidationError(
                'MCP server name is required and must be a non-empty string',
                { field: 'name', value: config.name }
            );
        }

        if (config.name.trim().length === 0) {
            throw new ValidationError(
                'MCP server name cannot be empty or whitespace only',
                { field: 'name', value: config.name }
            );
        }

        if (!config.url || typeof config.url !== 'string') {
            throw new ValidationError(
                'MCP server URL is required and must be a non-empty string',
                { field: 'url', value: config.url }
            );
        }

        if (config.url.trim().length === 0) {
            throw new ValidationError(
                'MCP server URL cannot be empty or whitespace only',
                { field: 'url', value: config.url }
            );
        }

        // Validate URL format
        try {
            const url = new URL(config.url);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                throw new ValidationError(
                    'MCP server URL must use HTTP or HTTPS protocol',
                    { field: 'url', value: config.url, protocol: url.protocol }
                );
            }
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError(
                'MCP server URL is not a valid URL',
                { field: 'url', value: config.url, error: (error as Error).message }
            );
        }

        // Validate optional fields
        if (config.description !== undefined && typeof config.description !== 'string') {
            throw new ValidationError(
                'MCP server description must be a string',
                { field: 'description', value: typeof config.description }
            );
        }

        if (config.authentication !== undefined) {
            this.validateMcpAuthConfig(config.authentication);
        }

        if (config.reconnect !== undefined) {
            this.validateMcpReconnectConfig(config.reconnect);
        }

        if (config.toolFilter !== undefined) {
            this.validateMcpToolFilter(config.toolFilter);
        }

        if (config.customHeaders !== undefined) {
            if (typeof config.customHeaders !== 'object' || Array.isArray(config.customHeaders) || config.customHeaders === null) {
                throw new ValidationError(
                    'MCP server customHeaders must be an object',
                    { field: 'customHeaders', value: typeof config.customHeaders }
                );
            }

            // Validate all header values are strings
            for (const [key, value] of Object.entries(config.customHeaders)) {
                if (typeof value !== 'string') {
                    throw new ValidationError(
                        `Custom header "${key}" must have a string value`,
                        { field: `customHeaders.${key}`, value: typeof value }
                    );
                }
            }
        }
    }

    /**
     * Validates ContentBlock for multimodal content to ensure proper format
     * and source configuration.
     * 
     * @param content - Content block to validate
     * @throws {ValidationError} If validation fails
     */
    static validateContentBlock(content: ContentBlock): void {
        if (!content) {
            throw new ValidationError(
                'Content block is required',
                { field: 'content' }
            );
        }

        if (typeof content !== 'object' || Array.isArray(content)) {
            throw new ValidationError(
                'Content block must be an object',
                { field: 'content', value: typeof content }
            );
        }

        // Determine content type and validate accordingly
        if ('text' in content) {
            this.validateTextContent(content);
        } else if ('image' in content) {
            this.validateImageContent(content);
        } else if ('document' in content) {
            this.validateDocumentContent(content);
        } else if ('video' in content) {
            this.validateVideoContent(content);
        } else if ('toolUse' in content) {
            this.validateToolUseContent(content);
        } else if ('toolResult' in content) {
            this.validateToolResultContent(content);
        } else {
            throw new ValidationError(
                'Content block must contain one of: text, image, document, video, toolUse, or toolResult',
                { field: 'content', keys: Object.keys(content) }
            );
        }
    }

    /**
     * Validates GuardrailConfig.
     */
    private static validateGuardrailConfig(config: any): void {
        if (!config.guardrailId || typeof config.guardrailId !== 'string') {
            throw new ValidationError(
                'Guardrail ID is required and must be a non-empty string',
                { field: 'guardrail.guardrailId', value: config.guardrailId }
            );
        }

        if (!config.guardrailVersion || typeof config.guardrailVersion !== 'string') {
            throw new ValidationError(
                'Guardrail version is required and must be a non-empty string',
                { field: 'guardrail.guardrailVersion', value: config.guardrailVersion }
            );
        }

        if (config.trace !== undefined && typeof config.trace !== 'boolean') {
            throw new ValidationError(
                'Guardrail trace must be a boolean',
                { field: 'guardrail.trace', value: config.trace }
            );
        }
    }

    /**
     * Validates MemoryConfig.
     */
    private static validateMemoryConfig(config: any): void {
        if (config.shortTerm) {
            if (typeof config.shortTerm !== 'object' || Array.isArray(config.shortTerm)) {
                throw new ValidationError(
                    'shortTerm memory config must be an object',
                    { field: 'memory.shortTerm', value: typeof config.shortTerm }
                );
            }

            if (config.shortTerm.maxMessages !== undefined) {
                if (typeof config.shortTerm.maxMessages !== 'number' || !Number.isInteger(config.shortTerm.maxMessages) || config.shortTerm.maxMessages < 1) {
                    throw new ValidationError(
                        'shortTerm.maxMessages must be a positive integer',
                        { field: 'memory.shortTerm.maxMessages', value: config.shortTerm.maxMessages }
                    );
                }
            }

            if (config.shortTerm.maxTokens !== undefined) {
                if (typeof config.shortTerm.maxTokens !== 'number' || !Number.isInteger(config.shortTerm.maxTokens) || config.shortTerm.maxTokens < 1) {
                    throw new ValidationError(
                        'shortTerm.maxTokens must be a positive integer',
                        { field: 'memory.shortTerm.maxTokens', value: config.shortTerm.maxTokens }
                    );
                }
            }
        }

        if (config.longTerm) {
            if (typeof config.longTerm !== 'object' || Array.isArray(config.longTerm)) {
                throw new ValidationError(
                    'longTerm memory config must be an object',
                    { field: 'memory.longTerm', value: typeof config.longTerm }
                );
            }

            if (!config.longTerm.fetch || typeof config.longTerm.fetch !== 'function') {
                throw new ValidationError(
                    'longTerm.fetch must be a function',
                    { field: 'memory.longTerm.fetch', value: typeof config.longTerm.fetch }
                );
            }

            if (!config.longTerm.save || typeof config.longTerm.save !== 'function') {
                throw new ValidationError(
                    'longTerm.save must be a function',
                    { field: 'memory.longTerm.save', value: typeof config.longTerm.save }
                );
            }
        }
    }

    /**
     * Validates TextContent.
     */
    private static validateTextContent(content: any): void {
        if (typeof content.text !== 'string') {
            throw new ValidationError(
                'Text content must be a string',
                { field: 'content.text', value: typeof content.text }
            );
        }

        if (content.text.trim().length === 0) {
            throw new ValidationError(
                'Text content cannot be empty or whitespace only',
                { field: 'content.text' }
            );
        }
    }

    /**
     * Validates ImageContent.
     */
    private static validateImageContent(content: any): void {
        if (!content.image || typeof content.image !== 'object') {
            throw new ValidationError(
                'Image content must have an image property',
                { field: 'content.image' }
            );
        }

        const validFormats = ['png', 'jpeg', 'gif', 'webp'];
        if (!content.image.format || !validFormats.includes(String(content.image.format))) {
            throw new ValidationError(
                `Image format must be one of: ${validFormats.join(', ')}`,
                { field: 'content.image.format', value: content.image.format }
            );
        }

        if (!content.image.source || typeof content.image.source !== 'object') {
            throw new ValidationError(
                'Image must have a source property',
                { field: 'content.image.source' }
            );
        }

        const hasBytes = content.image.source.bytes instanceof Uint8Array;
        const hasS3Location = content.image.source.s3Location && typeof content.image.source.s3Location === 'object';

        if (!hasBytes && !hasS3Location) {
            throw new ValidationError(
                'Image source must have either bytes (Uint8Array) or s3Location',
                { field: 'content.image.source' }
            );
        }

        if (hasBytes && hasS3Location) {
            throw new ValidationError(
                'Image source cannot have both bytes and s3Location',
                { field: 'content.image.source' }
            );
        }

        if (hasS3Location) {
            this.validateS3Location(content.image.source.s3Location);
        }
    }

    /**
     * Validates DocumentContent.
     */
    private static validateDocumentContent(content: any): void {
        if (!content.document || typeof content.document !== 'object') {
            throw new ValidationError(
                'Document content must have a document property',
                { field: 'content.document' }
            );
        }

        const validFormats = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'];
        if (!content.document.format || !validFormats.includes(String(content.document.format))) {
            throw new ValidationError(
                `Document format must be one of: ${validFormats.join(', ')}`,
                { field: 'content.document.format', value: content.document.format }
            );
        }

        if (!content.document.name || typeof content.document.name !== 'string') {
            throw new ValidationError(
                'Document must have a name property',
                { field: 'content.document.name', value: content.document.name }
            );
        }

        if (!content.document.source || typeof content.document.source !== 'object') {
            throw new ValidationError(
                'Document must have a source property',
                { field: 'content.document.source' }
            );
        }

        const hasBytes = content.document.source.bytes instanceof Uint8Array;
        const hasS3Location = content.document.source.s3Location && typeof content.document.source.s3Location === 'object';

        if (!hasBytes && !hasS3Location) {
            throw new ValidationError(
                'Document source must have either bytes (Uint8Array) or s3Location',
                { field: 'content.document.source' }
            );
        }

        if (hasBytes && hasS3Location) {
            throw new ValidationError(
                'Document source cannot have both bytes and s3Location',
                { field: 'content.document.source' }
            );
        }

        if (hasS3Location) {
            this.validateS3Location(content.document.source.s3Location);
        }
    }

    /**
     * Validates VideoContent.
     */
    private static validateVideoContent(content: any): void {
        if (!content.video || typeof content.video !== 'object') {
            throw new ValidationError(
                'Video content must have a video property',
                { field: 'content.video' }
            );
        }

        const validFormats = ['mp4', 'mov', 'avi', 'flv', 'mkv', 'webm'];
        if (!content.video.format || !validFormats.includes(String(content.video.format))) {
            throw new ValidationError(
                `Video format must be one of: ${validFormats.join(', ')}`,
                { field: 'content.video.format', value: content.video.format }
            );
        }

        if (!content.video.source || typeof content.video.source !== 'object') {
            throw new ValidationError(
                'Video must have a source property',
                { field: 'content.video.source' }
            );
        }

        const hasBytes = content.video.source.bytes instanceof Uint8Array;
        const hasS3Location = content.video.source.s3Location && typeof content.video.source.s3Location === 'object';

        if (!hasBytes && !hasS3Location) {
            throw new ValidationError(
                'Video source must have either bytes (Uint8Array) or s3Location',
                { field: 'content.video.source' }
            );
        }

        if (hasBytes && hasS3Location) {
            throw new ValidationError(
                'Video source cannot have both bytes and s3Location',
                { field: 'content.video.source' }
            );
        }

        if (hasS3Location) {
            this.validateS3Location(content.video.source.s3Location);
        }
    }

    /**
     * Validates ToolUseContent.
     */
    private static validateToolUseContent(content: any): void {
        if (!content.toolUse || typeof content.toolUse !== 'object') {
            throw new ValidationError(
                'Tool use content must have a toolUse property',
                { field: 'content.toolUse' }
            );
        }

        if (!content.toolUse.toolUseId || typeof content.toolUse.toolUseId !== 'string') {
            throw new ValidationError(
                'Tool use must have a toolUseId string',
                { field: 'content.toolUse.toolUseId', value: content.toolUse.toolUseId }
            );
        }

        if (!content.toolUse.name || typeof content.toolUse.name !== 'string') {
            throw new ValidationError(
                'Tool use must have a name string',
                { field: 'content.toolUse.name', value: content.toolUse.name }
            );
        }

        if (content.toolUse.input === undefined) {
            throw new ValidationError(
                'Tool use must have an input property',
                { field: 'content.toolUse.input' }
            );
        }
    }

    /**
     * Validates ToolResultContent.
     */
    private static validateToolResultContent(content: any): void {
        if (!content.toolResult || typeof content.toolResult !== 'object') {
            throw new ValidationError(
                'Tool result content must have a toolResult property',
                { field: 'content.toolResult' }
            );
        }

        if (!content.toolResult.toolUseId || typeof content.toolResult.toolUseId !== 'string') {
            throw new ValidationError(
                'Tool result must have a toolUseId string',
                { field: 'content.toolResult.toolUseId', value: content.toolResult.toolUseId }
            );
        }

        if (!Array.isArray(content.toolResult.content)) {
            throw new ValidationError(
                'Tool result content must be an array',
                { field: 'content.toolResult.content', value: typeof content.toolResult.content }
            );
        }

        if (content.toolResult.status !== undefined) {
            if (content.toolResult.status !== 'success' && content.toolResult.status !== 'error') {
                throw new ValidationError(
                    'Tool result status must be either "success" or "error"',
                    { field: 'content.toolResult.status', value: content.toolResult.status }
                );
            }
        }
    }

    /**
     * Validates S3Location.
     */
    private static validateS3Location(location: any): void {
        if (!location.uri || typeof location.uri !== 'string') {
            throw new ValidationError(
                'S3 location must have a uri string',
                { field: 's3Location.uri', value: location.uri }
            );
        }

        if (!location.uri.startsWith('s3://')) {
            throw new ValidationError(
                'S3 location uri must start with "s3://"',
                { field: 's3Location.uri', value: location.uri }
            );
        }

        if (location.bucketOwner !== undefined && typeof location.bucketOwner !== 'string') {
            throw new ValidationError(
                'S3 location bucketOwner must be a string',
                { field: 's3Location.bucketOwner', value: typeof location.bucketOwner }
            );
        }
    }

    /**
     * Validates McpAuthConfig.
     */
    private static validateMcpAuthConfig(config: any): void {
        if (typeof config !== 'object' || Array.isArray(config) || config === null) {
            throw new ValidationError(
                'MCP authentication config must be an object',
                { field: 'authentication', value: typeof config }
            );
        }

        if (!config.type || (config.type !== 'bearer' && config.type !== 'custom')) {
            throw new ValidationError(
                'MCP authentication type must be either "bearer" or "custom"',
                { field: 'authentication.type', value: config.type }
            );
        }

        if (config.type === 'bearer') {
            if (config.token !== undefined && typeof config.token !== 'string') {
                throw new ValidationError(
                    'MCP authentication token must be a string',
                    { field: 'authentication.token', value: typeof config.token }
                );
            }
        }

        if (config.headers !== undefined) {
            if (typeof config.headers !== 'object' || Array.isArray(config.headers) || config.headers === null) {
                throw new ValidationError(
                    'MCP authentication headers must be an object',
                    { field: 'authentication.headers', value: typeof config.headers }
                );
            }

            // Validate all header values are strings
            for (const [key, value] of Object.entries(config.headers as Record<string, unknown>)) {
                if (typeof value !== 'string') {
                    throw new ValidationError(
                        `Authentication header "${key}" must have a string value`,
                        { field: `authentication.headers.${key}`, value: typeof value }
                    );
                }
            }
        }
    }

    /**
     * Validates McpReconnectConfig.
     */
    private static validateMcpReconnectConfig(config: any): void {
        if (typeof config !== 'object' || Array.isArray(config) || config === null) {
            throw new ValidationError(
                'MCP reconnect config must be an object',
                { field: 'reconnect', value: typeof config }
            );
        }

        if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
            throw new ValidationError(
                'MCP reconnect enabled must be a boolean',
                { field: 'reconnect.enabled', value: typeof config.enabled }
            );
        }

        if (config.maxAttempts !== undefined) {
            if (typeof config.maxAttempts !== 'number' || !Number.isInteger(config.maxAttempts) || config.maxAttempts < 0) {
                throw new ValidationError(
                    'MCP reconnect maxAttempts must be a non-negative integer',
                    { field: 'reconnect.maxAttempts', value: config.maxAttempts }
                );
            }
        }

        if (config.baseDelay !== undefined) {
            if (typeof config.baseDelay !== 'number' || config.baseDelay < 0) {
                throw new ValidationError(
                    'MCP reconnect baseDelay must be a non-negative number',
                    { field: 'reconnect.baseDelay', value: config.baseDelay }
                );
            }
        }

        if (config.maxDelay !== undefined) {
            if (typeof config.maxDelay !== 'number' || config.maxDelay < 0) {
                throw new ValidationError(
                    'MCP reconnect maxDelay must be a non-negative number',
                    { field: 'reconnect.maxDelay', value: config.maxDelay }
                );
            }
        }
    }

    /**
     * Validates McpToolFilter.
     */
    private static validateMcpToolFilter(config: any): void {
        if (typeof config !== 'object' || Array.isArray(config) || config === null) {
            throw new ValidationError(
                'MCP tool filter must be an object',
                { field: 'toolFilter', value: typeof config }
            );
        }

        if (config.allowedTools !== undefined) {
            if (!Array.isArray(config.allowedTools)) {
                throw new ValidationError(
                    'MCP tool filter allowedTools must be an array',
                    { field: 'toolFilter.allowedTools', value: typeof config.allowedTools }
                );
            }

            config.allowedTools.forEach((tool: any, index: number) => {
                if (typeof tool !== 'string') {
                    throw new ValidationError(
                        `Allowed tool at index ${index} must be a string`,
                        { field: 'toolFilter.allowedTools', index, value: typeof tool }
                    );
                }
            });
        }

        if (config.deniedTools !== undefined) {
            if (!Array.isArray(config.deniedTools)) {
                throw new ValidationError(
                    'MCP tool filter deniedTools must be an array',
                    { field: 'toolFilter.deniedTools', value: typeof config.deniedTools }
                );
            }

            config.deniedTools.forEach((tool: any, index: number) => {
                if (typeof tool !== 'string') {
                    throw new ValidationError(
                        `Denied tool at index ${index} must be a string`,
                        { field: 'toolFilter.deniedTools', index, value: typeof tool }
                    );
                }
            });
        }
    }
}
