/**
 * Tracer setup utilities for AWS Powertools Tracer integration
 *
 * This module provides utilities for creating and configuring AWS Powertools Tracer
 * instances with sensible defaults for the Agent Bedrock.
 */

import { Tracer } from '@aws-lambda-powertools/tracer';

/**
 * Configuration options for creating a tracer instance.
 */
export interface TracerConfig {
    /**
     * Service name for the tracer (typically the agent name).
     */
    serviceName: string;

    /**
     * Whether to capture HTTP/HTTPS requests.
     *
     * @default true
     */
    captureHTTPsRequests?: boolean;
}

/**
 * Creates a configured AWS Powertools Tracer instance.
 *
 * @param config - Tracer configuration options
 * @returns Configured Tracer instance
 *
 * @example
 * ```typescript
 * const tracer = createTracer({
 *   serviceName: 'my-agent',
 *   captureHTTPsRequests: true
 * });
 * ```
 */
export function createTracer(config: TracerConfig): Tracer {
    return new Tracer({
        serviceName: config.serviceName,
        captureHTTPsRequests: config.captureHTTPsRequests ?? true,
    });
}

// Removed: Use tracer.putAnnotation/putMetadata directly instead of wrapper methods
