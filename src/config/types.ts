/**
 * Configuration type definitions for the Agent Bedrock
 *
 * This module contains all configuration interfaces and types used to
 * configure and customize Agent behavior.
 */

import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { ToolDefinition } from '../tools/types.js';
import type { Message } from './message-types.js';
import type { McpServerConfig } from '../mcp/types.js';

/**
 * Main configuration interface for creating an Agent instance.
 */
export interface AgentConfig {
    /**
     * Unique identifier for the Agent instance.
     * Used in logging and metrics.
     */
    name: string;

    /**
     * AWS Bedrock model identifier.
     *
     * @example 'anthropic.claude-3-sonnet-20240229-v1:0'
     * @example 'anthropic.claude-3-haiku-20240307-v1:0'
     */
    modelId: string;

    /**
     * Optional pre-configured Bedrock Runtime client.
     * If not provided, a default client will be created.
     */
    bedrockClient?: BedrockRuntimeClient;

    /**
     * AWS region for Bedrock API calls.
     * Only used if bedrockClient is not provided.
     *
     * @default Uses AWS SDK default region resolution
     */
    region?: string;

    /**
     * AWS Powertools Logger instance.
     * If not provided, a default logger will be created.
     */
    logger?: Logger;

    /**
     * Enable CloudWatch metrics emission.
     *
     * @default false
     */
    enableMetrics?: boolean;

    /**
     * Enable AWS X-Ray tracing.
     *
     * @default false
     */
    enableTracing?: boolean;

    /**
     * Model inference parameters.
     */
    modelConfig?: ModelConfig;

    /**
     * Human-readable description of the Agent's purpose.
     */
    description?: string;

    /**
     * Enable streaming responses using ConverseStream API.
     *
     * @default true
     */
    streaming?: boolean;

    /**
     * Tool definitions that the Agent can invoke.
     */
    tools?: ToolDefinition[];

    /**
     * Guardrail configuration for content filtering.
     */
    guardrail?: GuardrailConfig;

    /**
     * Memory configuration for conversation history management.
     */
    memory?: MemoryConfig;

    /**
     * System prompts to guide model behavior.
     * These prompts are included in all conversation turns.
     *
     * @internal
     */
    systemPrompts?: string[];

    /**
     * MCP (Model Context Protocol) server configurations.
     * Allows connecting to external MCP servers that provide additional tools and resources.
     *
     * @example
     * ```typescript
     * mcpServers: [{
     *   name: 'weather-service',
     *   url: 'https://weather-mcp.example.com/mcp',
     *   authentication: {
     *     type: 'bearer',
     *     token: process.env.WEATHER_API_TOKEN
     *   }
     * }]
     * ```
     */
    mcpServers?: McpServerConfig[];
}

/**
 * Model inference configuration parameters.
 * These parameters control how the model generates responses.
 */
export interface ModelConfig {
    /**
     * Controls randomness in generation.
     * Higher values make output more random, lower values more deterministic.
     *
     * @minimum 0
     * @maximum 1
     * @default Model-specific default
     */
    temperature?: number;

    /**
     * Maximum number of tokens to generate in the response.
     *
     * @minimum 1
     * @maximum Model-specific maximum
     */
    maxTokens?: number;

    /**
     * Nucleus sampling parameter.
     * Controls diversity via cumulative probability.
     *
     * @minimum 0
     * @maximum 1
     * @default Model-specific default
     */
    topP?: number;

    /**
     * Sequences that will stop generation when encountered.
     *
     * @maxItems Model-specific limit
     */
    stopSequences?: string[];
}

/**
 * Guardrail configuration for content filtering and safety controls.
 */
export interface GuardrailConfig {
    /**
     * AWS Bedrock Guardrail identifier.
     */
    guardrailId: string;

    /**
     * Version of the guardrail to use.
     */
    guardrailVersion: string;

    /**
     * Enable guardrail trace information in responses.
     *
     * @default false
     */
    trace?: boolean;
}

/**
 * Memory configuration for managing conversation history.
 */
export interface MemoryConfig {
    /**
     * Short-term (in-memory) conversation history settings.
     */
    shortTerm?: ShortTermMemoryConfig;

    /**
     * Long-term (persistent) conversation history settings.
     */
    longTerm?: LongTermMemoryConfig;
}

/**
 * Configuration for short-term memory management.
 */
export interface ShortTermMemoryConfig {
    /**
     * Maximum number of messages to retain in memory.
     * Older messages are pruned when limit is exceeded.
     *
     * @minimum 1
     * @default 50
     */
    maxMessages?: number;

    /**
     * Maximum total tokens to retain in memory.
     * Messages are pruned when token limit is exceeded.
     *
     * @minimum 1
     * @default 4000
     */
    maxTokens?: number;
}

/**
 * Configuration for long-term memory persistence.
 */
export interface LongTermMemoryConfig {
    /**
     * Callback to fetch conversation history from persistent storage.
     *
     * @param sessionId - Unique identifier for the conversation session
     * @returns Promise resolving to array of messages
     */
    fetch: (sessionId: string) => Promise<Message[]>;

    /**
     * Callback to save conversation history to persistent storage.
     *
     * @param sessionId - Unique identifier for the conversation session
     * @param messages - Array of messages to persist
     * @returns Promise resolving when save is complete
     */
    save: (sessionId: string, messages: Message[]) => Promise<void>;
}

/**
 * Retry configuration for handling transient errors.
 */
export interface RetryConfig {
    /**
     * Maximum number of retry attempts.
     *
     * @minimum 0
     * @default 3
     */
    maxRetries: number;

    /**
     * Base delay in milliseconds for exponential backoff.
     *
     * @minimum 0
     * @default 100
     */
    baseDelay: number;

    /**
     * Maximum delay in milliseconds between retries.
     *
     * @minimum 0
     * @default 5000
     */
    maxDelay: number;

    /**
     * List of error codes that should trigger a retry.
     */
    retryableErrors: string[];
}
