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

// Removed: Use metrics.addMetric() directly instead of wrapper methods
