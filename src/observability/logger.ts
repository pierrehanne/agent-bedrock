/**
 * Logger setup utilities for AWS Powertools Logger integration
 * 
 * This module provides utilities for creating and configuring AWS Powertools Logger
 * instances with sensible defaults for the Agent Bedrock.
 */

import { Logger } from '@aws-lambda-powertools/logger';

/**
 * Configuration options for creating a logger instance.
 */
export interface LoggerConfig {
    /**
     * Service name for the logger (typically the agent name).
     */
    serviceName: string;

    /**
     * Log level for the logger.
     * 
     * @default 'INFO' or value from LOG_LEVEL environment variable
     */
    logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

    /**
     * Persistent attributes to include in all log entries.
     */
    persistentLogAttributes?: Record<string, string | number | boolean>;

    /**
     * Sample rate for debug logs (0-1).
     * 
     * @default 0 (no sampling)
     */
    sampleRateValue?: number;
}

/**
 * Creates a configured AWS Powertools Logger instance.
 * 
 * @param config - Logger configuration options
 * @returns Configured Logger instance
 * 
 * @example
 * ```typescript
 * const logger = createLogger({
 *   serviceName: 'my-agent',
 *   logLevel: 'DEBUG',
 *   persistentLogAttributes: {
 *     modelId: 'anthropic.claude-3-sonnet-20240229-v1:0'
 *   }
 * });
 * ```
 */
export function createLogger(config: LoggerConfig): Logger {
    return new Logger({
        serviceName: config.serviceName,
        logLevel: config.logLevel || (process.env.LOG_LEVEL as any) || 'INFO',
        persistentLogAttributes: config.persistentLogAttributes,
        sampleRateValue: config.sampleRateValue,
    });
}

/**
 * Helper methods for common logging patterns in the Agent Framework.
 */
export class LoggerHelper {
    constructor(private logger: Logger) { }

    /**
     * Logs agent initialization.
     * 
     * @param agentName - Name of the agent
     * @param modelId - Model identifier
     * @param config - Additional configuration details
     */
    logAgentInitialized(
        agentName: string,
        modelId: string,
        config?: Record<string, any>
    ): void {
        this.logger.info('Agent initialized', {
            agentName,
            modelId,
            ...config,
        });
    }

    /**
     * Logs the start of a conversation turn.
     * 
     * @param sessionId - Optional session identifier
     * @param messageLength - Length of the user message
     */
    logConversationStart(sessionId?: string, messageLength?: number): void {
        this.logger.info('Conversation turn started', {
            sessionId,
            messageLength,
        });
    }

    /**
     * Logs the completion of a conversation turn.
     * 
     * @param sessionId - Optional session identifier
     * @param responseLength - Length of the assistant response
     * @param tokensUsed - Number of tokens consumed
     * @param latencyMs - Response latency in milliseconds
     */
    logConversationComplete(
        sessionId?: string,
        responseLength?: number,
        tokensUsed?: number,
        latencyMs?: number
    ): void {
        this.logger.info('Conversation turn completed', {
            sessionId,
            responseLength,
            tokensUsed,
            latencyMs,
        });
    }

    /**
     * Logs tool execution start.
     * 
     * @param toolName - Name of the tool being executed
     * @param toolUseId - Unique identifier for this tool use
     */
    logToolExecutionStart(toolName: string, toolUseId: string): void {
        this.logger.debug('Tool execution started', {
            toolName,
            toolUseId,
        });
    }

    /**
     * Logs successful tool execution.
     * 
     * @param toolName - Name of the tool
     * @param toolUseId - Unique identifier for this tool use
     * @param latencyMs - Execution latency in milliseconds
     */
    logToolExecutionSuccess(
        toolName: string,
        toolUseId: string,
        latencyMs: number
    ): void {
        this.logger.info('Tool execution succeeded', {
            toolName,
            toolUseId,
            latencyMs,
        });
    }

    /**
     * Logs tool execution failure.
     * 
     * @param toolName - Name of the tool
     * @param toolUseId - Unique identifier for this tool use
     * @param error - Error that occurred
     */
    logToolExecutionError(
        toolName: string,
        toolUseId: string,
        error: Error
    ): void {
        this.logger.error('Tool execution failed', {
            toolName,
            toolUseId,
            error: error.message,
            errorStack: error.stack,
        });
    }

    /**
     * Logs memory operations.
     * 
     * @param operation - Type of memory operation
     * @param sessionId - Session identifier
     * @param messageCount - Number of messages in memory
     */
    logMemoryOperation(
        operation: 'load' | 'save' | 'clear' | 'prune',
        sessionId?: string,
        messageCount?: number
    ): void {
        this.logger.debug('Memory operation', {
            operation,
            sessionId,
            messageCount,
        });
    }

    /**
     * Logs guardrail interventions.
     * 
     * @param action - Guardrail action taken
     * @param details - Additional details about the intervention
     */
    logGuardrailIntervention(
        action: string,
        details?: Record<string, any>
    ): void {
        this.logger.warn('Guardrail intervention', {
            action,
            ...details,
        });
    }

    /**
     * Logs API retry attempts.
     * 
     * @param attempt - Current retry attempt number
     * @param maxRetries - Maximum number of retries
     * @param error - Error that triggered the retry
     * @param delayMs - Delay before next retry in milliseconds
     */
    logRetryAttempt(
        attempt: number,
        maxRetries: number,
        error: Error,
        delayMs: number
    ): void {
        this.logger.warn('Retrying API call', {
            attempt,
            maxRetries,
            error: error.message,
            delayMs,
        });
    }

    /**
     * Logs stream events.
     * 
     * @param eventType - Type of stream event
     * @param details - Additional event details
     */
    logStreamEvent(eventType: string, details?: Record<string, any>): void {
        this.logger.debug('Stream event', {
            eventType,
            ...details,
        });
    }
}
