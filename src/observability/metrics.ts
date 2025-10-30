/**
 * Metrics setup utilities for AWS Powertools Metrics integration
 * 
 * This module provides utilities for creating and configuring AWS Powertools Metrics
 * instances with sensible defaults for the Agent Bedrock.
 */

import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

/**
 * Configuration options for creating a metrics instance.
 */
export interface MetricsConfig {
    /**
     * CloudWatch namespace for metrics.
     * 
     * @default 'BedrockAgents'
     */
    namespace?: string;

    /**
     * Service name for the metrics (typically the agent name).
     */
    serviceName: string;

    /**
     * Default dimensions to include with all metrics.
     */
    defaultDimensions?: Record<string, string>;
}

/**
 * Creates a configured AWS Powertools Metrics instance.
 * 
 * @param config - Metrics configuration options
 * @returns Configured Metrics instance
 * 
 * @example
 * ```typescript
 * const metrics = createMetrics({
 *   serviceName: 'my-agent',
 *   defaultDimensions: {
 *     modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
 *     environment: 'production'
 *   }
 * });
 * ```
 */
export function createMetrics(config: MetricsConfig): Metrics {
    return new Metrics({
        namespace: config.namespace || 'BedrockAgents',
        serviceName: config.serviceName,
        defaultDimensions: config.defaultDimensions,
    });
}

/**
 * Helper methods for common metric patterns in the Agent Framework.
 */
export class MetricsHelper {
    constructor(private metrics: Metrics) { }

    /**
     * Records a conversation started event.
     */
    recordConversationStarted(): void {
        this.metrics.addMetric('ConversationStarted', MetricUnit.Count, 1);
    }

    /**
     * Records a conversation completed event.
     */
    recordConversationCompleted(): void {
        this.metrics.addMetric('ConversationCompleted', MetricUnit.Count, 1);
    }

    /**
     * Records token usage.
     * 
     * @param inputTokens - Number of input tokens
     * @param outputTokens - Number of output tokens
     * @param totalTokens - Total number of tokens
     */
    recordTokenUsage(
        inputTokens: number,
        outputTokens: number,
        totalTokens: number
    ): void {
        this.metrics.addMetric('InputTokens', MetricUnit.Count, inputTokens);
        this.metrics.addMetric('OutputTokens', MetricUnit.Count, outputTokens);
        this.metrics.addMetric('TotalTokens', MetricUnit.Count, totalTokens);
    }

    /**
     * Records response latency.
     * 
     * @param latencyMs - Latency in milliseconds
     */
    recordResponseLatency(latencyMs: number): void {
        this.metrics.addMetric(
            'ResponseLatency',
            MetricUnit.Milliseconds,
            latencyMs
        );
    }

    /**
     * Records tool execution metrics.
     * 
     * @param toolName - Name of the tool
     * @param success - Whether execution was successful
     * @param latencyMs - Execution latency in milliseconds
     */
    recordToolExecution(
        toolName: string,
        success: boolean,
        latencyMs: number
    ): void {
        this.metrics.addDimensions({ toolName });

        if (success) {
            this.metrics.addMetric('ToolExecutionSuccess', MetricUnit.Count, 1);
        } else {
            this.metrics.addMetric('ToolExecutionFailure', MetricUnit.Count, 1);
        }

        this.metrics.addMetric(
            'ToolExecutionLatency',
            MetricUnit.Milliseconds,
            latencyMs
        );
    }

    /**
     * Records guardrail intervention.
     * 
     * @param action - Guardrail action taken
     */
    recordGuardrailIntervention(action: string): void {
        this.metrics.addDimensions({ guardrailAction: action });
        this.metrics.addMetric('GuardrailIntervention', MetricUnit.Count, 1);
    }

    /**
     * Records API errors.
     * 
     * @param errorType - Type of error
     */
    recordAPIError(errorType: string): void {
        this.metrics.addDimensions({ errorType });
        this.metrics.addMetric('APIError', MetricUnit.Count, 1);
    }

    /**
     * Records retry attempts.
     * 
     * @param attempt - Retry attempt number
     */
    recordRetryAttempt(attempt: number): void {
        this.metrics.addMetric('RetryAttempt', MetricUnit.Count, 1);
        this.metrics.addMetric('RetryAttemptNumber', MetricUnit.Count, attempt);
    }

    /**
     * Records memory operations.
     * 
     * @param operation - Type of memory operation
     * @param messageCount - Number of messages in memory
     */
    recordMemoryOperation(
        operation: 'load' | 'save' | 'clear' | 'prune',
        messageCount?: number
    ): void {
        this.metrics.addDimensions({ memoryOperation: operation });
        this.metrics.addMetric('MemoryOperation', MetricUnit.Count, 1);

        if (messageCount !== undefined) {
            this.metrics.addMetric(
                'MemoryMessageCount',
                MetricUnit.Count,
                messageCount
            );
        }
    }

    /**
     * Records streaming metrics.
     * 
     * @param eventCount - Number of stream events processed
     * @param latencyMs - Total streaming latency
     */
    recordStreamingMetrics(eventCount: number, latencyMs: number): void {
        this.metrics.addMetric('StreamEventCount', MetricUnit.Count, eventCount);
        this.metrics.addMetric(
            'StreamingLatency',
            MetricUnit.Milliseconds,
            latencyMs
        );
    }

    /**
     * Publishes all stored metrics to CloudWatch.
     * Should be called at the end of each Lambda invocation.
     */
    publishMetrics(): void {
        this.metrics.publishStoredMetrics();
    }
}
