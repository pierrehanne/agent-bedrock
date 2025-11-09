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

// Removed: Use logger.info/debug/error directly instead of wrapper methods
