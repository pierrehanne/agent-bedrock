import type { Message } from '../config/message-types.js';

export interface MemoryState {
    messageCount: number;
    estimatedTokens: number;
    sessionId?: string;
    lastUpdated: Date;
}

export interface PruneOptions {
    maxMessages?: number;
    maxTokens?: number;
    /** @default 'oldest' */
    strategy?: 'oldest' | 'least-important';
}

export interface PruneResult {
    messagesRemoved: number;
    tokensFreed: number;
    removedMessages: Message[];
}

export interface MemoryOperationResult {
    success: boolean;
    error?: string;
    metadata?: Record<string, any>;
}
