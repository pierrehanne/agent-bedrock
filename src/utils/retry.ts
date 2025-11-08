import type { Logger } from '@aws-lambda-powertools/logger';
import { APIError, ErrorCode, BedrockAgentError } from '../errors/index.js';

export interface RetryConfig {
    /** @default 3 */
    maxRetries: number;
    /** @default 100 */
    baseDelay: number;
    /** @default 5000 */
    maxDelay: number;
    retryableErrors: ErrorCode[];
}

/**
 * Default retry configuration.
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 5000,
    retryableErrors: [ErrorCode.API_THROTTLED, ErrorCode.API_TIMEOUT, ErrorCode.API_INTERNAL_ERROR],
};

export class RetryHandler {
    private readonly config: RetryConfig;
    private readonly logger: Logger;

    constructor(config: Partial<RetryConfig>, logger: Logger) {
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
        this.logger = logger;
    }

    async executeWithRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
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
                    this.logger.error(
                        `Operation failed after ${this.config.maxRetries} retries: ${context}`,
                        {
                            error: lastError,
                            totalAttempts: attempt,
                        },
                    );
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

        return retryableErrorNames.some(
            (name) => error.name === name || error.message.includes(name),
        );
    }

    /** Calculates exponential backoff with jitter to prevent thundering herd. */
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

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
