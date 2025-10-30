/**
 * Stream-related type definitions for the Agent Bedrock.
 * 
 * This module contains interfaces and types for handling streaming
 * responses from the Bedrock ConverseStream API.
 */

import type { ContentBlock, TokenUsage } from '../config/message-types.js';

/**
 * Union type representing all possible stream event types.
 */
export type StreamEvent =
    | MessageStartEvent
    | ContentBlockStartEvent
    | ContentBlockDeltaEvent
    | ContentBlockStopEvent
    | MessageStopEvent
    | MetadataEvent
    | ErrorEvent;

/**
 * Event emitted when a message starts streaming.
 */
export interface MessageStartEvent {
    /**
     * Event type identifier.
     */
    type: 'messageStart';

    /**
     * Message role.
     */
    role: 'assistant';
}

/**
 * Event emitted when a content block starts.
 */
export interface ContentBlockStartEvent {
    /**
     * Event type identifier.
     */
    type: 'contentBlockStart';

    /**
     * Index of the content block.
     */
    contentBlockIndex: number;

    /**
     * Initial content block data.
     */
    start: Partial<ContentBlock>;
}

/**
 * Event emitted for incremental content updates.
 */
export interface ContentBlockDeltaEvent {
    /**
     * Event type identifier.
     */
    type: 'contentBlockDelta';

    /**
     * Index of the content block being updated.
     */
    contentBlockIndex: number;

    /**
     * Delta (incremental change) to the content.
     */
    delta: ContentDelta;
}

/**
 * Content delta for incremental updates.
 */
export type ContentDelta =
    | { text: string }
    | { toolUse: { input: string } };

/**
 * Event emitted when a content block completes.
 */
export interface ContentBlockStopEvent {
    /**
     * Event type identifier.
     */
    type: 'contentBlockStop';

    /**
     * Index of the completed content block.
     */
    contentBlockIndex: number;
}

/**
 * Event emitted when the message completes.
 */
export interface MessageStopEvent {
    /**
     * Event type identifier.
     */
    type: 'messageStop';

    /**
     * Reason why generation stopped.
     */
    stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'content_filtered' | 'guardrail_intervened';

    /**
     * Additional stop reason details.
     */
    additionalModelResponseFields?: Record<string, any>;
}

/**
 * Event containing metadata about the conversation.
 */
export interface MetadataEvent {
    /**
     * Event type identifier.
     */
    type: 'metadata';

    /**
     * Token usage statistics.
     */
    usage: TokenUsage;

    /**
     * Metrics about the request.
     */
    metrics?: {
        /**
         * Latency in milliseconds.
         */
        latencyMs: number;
    };
}

/**
 * Event emitted when a stream error occurs.
 */
export interface ErrorEvent {
    /**
     * Event type identifier.
     */
    type: 'error';

    /**
     * Error message.
     */
    error: string;

    /**
     * Error code.
     */
    code?: string;

    /**
     * Additional error details.
     */
    details?: any;
}

/**
 * Stream handler configuration.
 */
export interface StreamHandlerConfig {
    /**
     * Enable detailed logging of stream events.
     * 
     * @default false
     */
    enableDebugLogging?: boolean;

    /**
     * Timeout in milliseconds for stream operations.
     * 
     * @default 300000 (5 minutes)
     */
    streamTimeout?: number;
}

/**
 * Accumulated stream state during processing.
 */
export interface StreamState {
    /**
     * Accumulated content blocks.
     */
    contentBlocks: ContentBlock[];

    /**
     * Current content block being built.
     */
    currentBlock?: Partial<ContentBlock>;

    /**
     * Stop reason when stream completes.
     */
    stopReason?: string;

    /**
     * Token usage statistics.
     */
    usage?: TokenUsage;

    /**
     * Whether an error occurred.
     */
    hasError: boolean;
}
