/**
 * Retry logic utility for handling transient errors with exponential backoff.
 * 
 * This module provides retry functionality for operations that may fail due to
 * transient errors such as network issues, throttling, or temporary service unavailability.
 */

import type { Logger } from '@aws-lambda-powertools/logger';
import { APIError, ErrorCode, BedrockAgentError } from '../errors/index.js';

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
    /**
     * Maximum number of retry attempts.
     * @default 3
     */
    maxRetries: number;

    /**
     * Base delay in milliseconds before first retry.
     * @default 100
     */
    baseDelay: number;

    /**
     * Maximum delay in milliseconds between retries.
     * @default 5000
     */
    maxDelay: number;

    /**
     * Error codes that should trigger a retry.
     * @default [ErrorCode.API_THROTTLED, ErrorCode.API_TIMEOUT, ErrorCode.API_INTERNAL_ERROR]
     */
    retryableErrors: ErrorCode[];
}

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 5000,
    retryableErrors: [
        ErrorCode.API_THROTTLED,
        ErrorCode.API_TIMEOUT,
        ErrorCode.API_INTERNAL_ERROR,
    ],
};

/**
 * Handler for retry logic with exponential backoff.
 * 
 * @example
 * ```typescript
 * const retryHandler = new RetryHandler(config, logger);
 * 
 * const result = await retryHandler.executeWithRetry(
 *   async () => await bedrockClient.converse(params),
 *   'BedrockAPICall'
 * );
 * ```
 */
export class RetryHandler {
    private readonly config: RetryConfig;
    private readonly logger: Logger;

    /**
     * Create a new RetryHandler instance.
     * 
     * @param config - Retry configuration (merged with defaults)
     * @param logger - Logger instance for logging retry attempts
     */
    constructor(config: Partial<RetryConfig>, logger: Logger) {
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
        this.logger = logger;
    }

    /**
     * Execute an async operation with retry logic.
     * 
     * @param operation - The async operation to execute
     * @param context - Context string for logging (e.g., 'BedrockAPICall')
     * @returns Promise resolving to the operation result
     * @throws The last error if all retries are exhausted
     * 
     * @example
     * ```typescript
     * const result = await retryHandler.executeWithRetry(
     *   async () => await apiCall(),
     *   'MyAPICall'
     * );
     * ```
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: string
    ): Promise<T> {
        let lastError: Error | undefined;
        let attempt = 0;

        while (attempt <= this.config.maxRetries) {
            try {
                // Log first attempt differently than retries
                if (attempt === 0) {
                    this.logger.debug(`Executing operation: ${context}`);
                } else {
                    this.logger.info(`Retry attempt ${attempt} for: ${context}`);
                }

                const result = await operation();

                // Log success if this was a retry
                if (attempt > 0) {
                    this.logger.info(`Operation succeeded after ${attempt} retries: ${context}`);
                }

                return result;
            } catch (error) {
                lastError = error as Error;
                attempt++;

                // Check if we should retry
                if (!this.shouldRetry(lastError, attempt)) {
                    this.logger.error(`Operation failed (not retryable): ${context}`, {
                        error: lastError,
                        attempt,
                    });
                    throw lastError;
                }

                // Check if we've exhausted retries
                if (attempt > this.config.maxRetries) {
                    this.logger.error(`Operation failed after ${this.config.maxRetries} retries: ${context}`, {
                        error: lastError,
                        totalAttempts: attempt,
                    });
                    throw lastError;
                }

                // Calculate delay and wait
                const delay = this.calculateDelay(attempt);
                this.logger.warn(`Operation failed, retrying in ${delay}ms: ${context}`, {
                    error: lastError,
                    attempt,
                    nextRetryIn: delay,
                });

                await this.sleep(delay);
            }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError || new Error('Operation failed with unknown error');
    }

    /**
     * Determine if an error should trigger a retry.
     * 
     * @param error - The error to check
     * @param attempt - Current attempt number (1-indexed)
     * @returns true if the error is retryable and we haven't exceeded max retries
     */
    private shouldRetry(error: Error, attempt: number): boolean {
        // Don't retry if we've exceeded max retries
        if (attempt > this.config.maxRetries) {
            return false;
        }

        // Check if it's a BedrockAgentError with a retryable error code
        if (error instanceof BedrockAgentError) {
            const isRetryableCode = this.config.retryableErrors.includes(error.code);

            // For APIError, also check the retryable flag
            if (error instanceof APIError) {
                return error.retryable || isRetryableCode;
            }

            return isRetryableCode;
        }

        // Check for common AWS SDK error names that are retryable
        const retryableErrorNames = [
            'ThrottlingException',
            'TooManyRequestsException',
            'ServiceUnavailableException',
            'InternalServerError',
            'RequestTimeout',
            'TimeoutError',
            'NetworkingError',
            'ProvisionedThroughputExceededException',
        ];

        return retryableErrorNames.some(name =>
            error.name === name || error.message.includes(name)
        );
    }

    /**
     * Calculate delay for exponential backoff with jitter.
     * 
     * Uses exponential backoff: delay = baseDelay * (2 ^ (attempt - 1))
     * Adds jitter to prevent thundering herd: delay * (0.5 + random(0, 0.5))
     * 
     * @param attempt - Current attempt number (1-indexed)
     * @returns Delay in milliseconds
     */
    private calculateDelay(attempt: number): number {
        // Calculate exponential backoff: baseDelay * 2^(attempt-1)
        const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt - 1);

        // Cap at maxDelay
        const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

        // Add jitter: multiply by random value between 0.5 and 1.0
        // This helps prevent thundering herd problem
        const jitter = 0.5 + Math.random() * 0.5;
        const delayWithJitter = Math.floor(cappedDelay * jitter);

        return delayWithJitter;
    }

    /**
     * Sleep for specified milliseconds.
     * 
     * @param ms - Milliseconds to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
