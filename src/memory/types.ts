/**
 * Memory-related type definitions for the Agent Bedrock.
 *
 * This module contains interfaces and types for managing conversation
 * history in both short-term (in-memory) and long-term (persistent) storage.
 */

import type { Message } from '../config/message-types.js';

/**
 * Memory manager state and statistics.
 */
export interface MemoryState {
    /**
     * Current number of messages in memory.
     */
    messageCount: number;

    /**
     * Estimated total tokens in memory.
     */
    estimatedTokens: number;

    /**
     * Session identifier (if using long-term memory).
     */
    sessionId?: string;

    /**
     * Timestamp of last memory operation.
     */
    lastUpdated: Date;
}

/**
 * Options for memory pruning operations.
 */
export interface PruneOptions {
    /**
     * Maximum messages to retain.
     */
    maxMessages?: number;

    /**
     * Maximum tokens to retain.
     */
    maxTokens?: number;

    /**
     * Strategy for selecting messages to prune.
     *
     * @default 'oldest'
     */
    strategy?: 'oldest' | 'least-important';
}

/**
 * Result of a memory pruning operation.
 */
export interface PruneResult {
    /**
     * Number of messages removed.
     */
    messagesRemoved: number;

    /**
     * Estimated tokens freed.
     */
    tokensFreed: number;

    /**
     * Messages that were removed.
     */
    removedMessages: Message[];
}

/**
 * Memory operation result.
 */
export interface MemoryOperationResult {
    /**
     * Whether the operation succeeded.
     */
    success: boolean;

    /**
     * Error message if operation failed.
     */
    error?: string;

    /**
     * Additional operation metadata.
     */
    metadata?: Record<string, any>;
}
