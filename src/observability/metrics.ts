import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';

export interface MetricsConfig {
    /** @default 'BedrockAgents' */
    namespace?: string;
    serviceName: string;
    defaultDimensions?: Record<string, string>;
}

export function createMetrics(config: MetricsConfig): Metrics {
    return new Metrics({
        namespace: config.namespace || 'BedrockAgents',
        serviceName: config.serviceName,
        defaultDimensions: config.defaultDimensions,
    });
}

export class MetricsHelper {
    constructor(private metrics: Metrics) { }

    recordConversationStarted(): void {
        this.metrics.addMetric('ConversationStarted', MetricUnit.Count, 1);
    }

    recordConversationCompleted(): void {
        this.metrics.addMetric('ConversationCompleted', MetricUnit.Count, 1);
    }

    recordTokenUsage(inputTokens: number, outputTokens: number, totalTokens: number): void {
        this.metrics.addMetric('InputTokens', MetricUnit.Count, inputTokens);
        this.metrics.addMetric('OutputTokens', MetricUnit.Count, outputTokens);
        this.metrics.addMetric('TotalTokens', MetricUnit.Count, totalTokens);
    }

    recordResponseLatency(latencyMs: number): void {
        this.metrics.addMetric('ResponseLatency', MetricUnit.Milliseconds, latencyMs);
    }

    recordToolExecution(toolName: string, success: boolean, latencyMs: number): void {
        this.metrics.addDimensions({ toolName });

        if (success) {
            this.metrics.addMetric('ToolExecutionSuccess', MetricUnit.Count, 1);
        } else {
            this.metrics.addMetric('ToolExecutionFailure', MetricUnit.Count, 1);
        }

        this.metrics.addMetric('ToolExecutionLatency', MetricUnit.Milliseconds, latencyMs);
    }

    recordGuardrailIntervention(action: string): void {
        this.metrics.addDimensions({ guardrailAction: action });
        this.metrics.addMetric('GuardrailIntervention', MetricUnit.Count, 1);
    }

    recordAPIError(errorType: string): void {
        this.metrics.addDimensions({ errorType });
        this.metrics.addMetric('APIError', MetricUnit.Count, 1);
    }

    recordRetryAttempt(attempt: number): void {
        this.metrics.addMetric('RetryAttempt', MetricUnit.Count, 1);
        this.metrics.addMetric('RetryAttemptNumber', MetricUnit.Count, attempt);
    }

    recordMemoryOperation(
        operation: 'load' | 'save' | 'clear' | 'prune',
        messageCount?: number,
    ): void {
        this.metrics.addDimensions({ memoryOperation: operation });
        this.metrics.addMetric('MemoryOperation', MetricUnit.Count, 1);

        if (messageCount !== undefined) {
            this.metrics.addMetric('MemoryMessageCount', MetricUnit.Count, messageCount);
        }
    }

    recordStreamingMetrics(eventCount: number, latencyMs: number): void {
        this.metrics.addMetric('StreamEventCount', MetricUnit.Count, eventCount);
        this.metrics.addMetric('StreamingLatency', MetricUnit.Milliseconds, latencyMs);
    }

    /** Publishes all stored metrics to CloudWatch. Call at end of Lambda invocation. */
    publishMetrics(): void {
        this.metrics.publishStoredMetrics();
    }
}
