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

/**
 * Helper methods for common tracing patterns in the Agent Framework.
 */
export class TracerHelper {
    constructor(private tracer: Tracer) { }

    /**
     * Adds annotations to the current trace segment.
     * Annotations are indexed and can be used for filtering traces.
     * 
     * @param key - Annotation key
     * @param value - Annotation value
     */
    addAnnotation(key: string, value: string | number | boolean): void {
        this.tracer.putAnnotation(key, value);
    }

    /**
     * Adds metadata to the current trace segment.
     * Metadata is not indexed but provides additional context.
     * 
     * @param key - Metadata key
     * @param value - Metadata value
     */
    addMetadata(key: string, value: any): void {
        this.tracer.putMetadata(key, value);
    }

    /**
     * Traces agent initialization.
     * 
     * @param agentName - Name of the agent
     * @param modelId - Model identifier
     * @param config - Additional configuration
     */
    traceAgentInitialization(
        agentName: string,
        modelId: string,
        config?: Record<string, any>
    ): void {
        this.addAnnotation('agentName', agentName);
        this.addAnnotation('modelId', modelId);

        if (config) {
            this.addMetadata('agentConfig', config);
        }
    }

    /**
     * Traces a conversation turn.
     * 
     * @param sessionId - Optional session identifier
     * @param streaming - Whether streaming is enabled
     */
    traceConversationTurn(sessionId?: string, streaming?: boolean): void {
        if (sessionId) {
            this.addAnnotation('sessionId', sessionId);
        }
        if (streaming !== undefined) {
            this.addAnnotation('streaming', streaming);
        }
    }

    /**
     * Traces tool execution.
     * 
     * @param toolName - Name of the tool
     * @param toolUseId - Unique identifier for this tool use
     * @param success - Whether execution was successful
     */
    traceToolExecution(
        toolName: string,
        toolUseId: string,
        success: boolean
    ): void {
        this.addAnnotation('toolName', toolName);
        this.addAnnotation('toolUseId', toolUseId);
        this.addAnnotation('toolSuccess', success);
    }

    /**
     * Traces guardrail intervention.
     * 
     * @param action - Guardrail action taken
     */
    traceGuardrailIntervention(action: string): void {
        this.addAnnotation('guardrailAction', action);
    }

    /**
     * Traces memory operations.
     * 
     * @param operation - Type of memory operation
     * @param messageCount - Number of messages
     */
    traceMemoryOperation(
        operation: 'load' | 'save' | 'clear' | 'prune',
        messageCount?: number
    ): void {
        this.addAnnotation('memoryOperation', operation);
        if (messageCount !== undefined) {
            this.addAnnotation('messageCount', messageCount);
        }
    }

    /**
     * Creates a subsegment for a specific operation.
     * Useful for tracking detailed timing of operations.
     * 
     * @param name - Name of the subsegment
     * @param callback - Function to execute within the subsegment
     * @returns Result of the callback
     * 
     * @example
     * ```typescript
     * const result = await tracerHelper.withSubsegment('BedrockAPICall', async () => {
     *   return await bedrockClient.send(command);
     * });
     * ```
     */
    async withSubsegment<T>(
        name: string,
        callback: () => Promise<T>
    ): Promise<T> {
        const segment = this.tracer.getSegment();
        if (!segment) {
            // If no active segment, just execute the callback
            return callback();
        }

        const subsegment = segment.addNewSubsegment(name);

        try {
            const result = await callback();
            subsegment.close();
            return result;
        } catch (error) {
            subsegment.addError(error as Error);
            subsegment.close();
            throw error;
        }
    }

    /**
     * Creates a subsegment for synchronous operations.
     * 
     * @param name - Name of the subsegment
     * @param callback - Function to execute within the subsegment
     * @returns Result of the callback
     */
    withSubsegmentSync<T>(name: string, callback: () => T): T {
        const segment = this.tracer.getSegment();
        if (!segment) {
            // If no active segment, just execute the callback
            return callback();
        }

        const subsegment = segment.addNewSubsegment(name);

        try {
            const result = callback();
            subsegment.close();
            return result;
        } catch (error) {
            subsegment.addError(error as Error);
            subsegment.close();
            throw error;
        }
    }
}
