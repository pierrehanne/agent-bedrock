/**
 * Memory Manager for conversation history management.
 * 
 * This module provides short-term (in-memory) and long-term (persistent)
 * conversation history management with automatic pruning based on message
 * count and token limits.
 */

import type { Logger } from '@aws-lambda-powertools/logger';
import type { Message } from '../config/message-types.js';
import type { MemoryConfig, LongTermMemoryConfig } from '../config/types.js';
import { MemoryError, ErrorCode } from '../errors/index.js';
import { TokenEstimator } from '../utils/tokens.js';

/**
 * Default configuration values for memory management.
 */
const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_MAX_TOKENS = 4000;

/**
 * Manages conversation history with support for short-term and long-term memory.
 * 
 * Short-term memory is stored in-memory and automatically pruned based on
 * message count and token limits. Long-term memory is persisted using
 * user-provided fetch and save callbacks.
 * 
 * @example
 * ```typescript
 * const memoryManager = new MemoryManager(
 *   {
 *     shortTerm: { maxMessages: 20, maxTokens: 4000 },
 *     longTerm: {
 *       fetch: async (sessionId) => await db.getMessages(sessionId),
 *       save: async (sessionId, messages) => await db.saveMessages(sessionId, messages)
 *     }
 *   },
 *   logger
 * );
 * 
 * // Add messages to history
 * memoryManager.addMessage({ role: 'user', content: [{ text: 'Hello' }] });
 * 
 * // Load from long-term storage
 * await memoryManager.loadSession('session-123');
 * 
 * // Save to long-term storage
 * await memoryManager.saveSession('session-123');
 * ```
 */
export class MemoryManager {
    private shortTermMemory: Message[] = [];
    private readonly maxMessages: number;
    private readonly maxTokens: number;
    private readonly longTermConfig?: LongTermMemoryConfig;
    private readonly logger: Logger;
    private readonly tokenEstimator: TokenEstimator;

    /**
     * Creates a new MemoryManager instance.
     * 
     * @param config - Memory configuration
     * @param logger - Logger instance for logging memory operations
     */
    constructor(config: MemoryConfig | undefined, logger: Logger) {
        this.logger = logger;

        // Configure short-term memory limits
        const shortTermConfig = config?.shortTerm;
        this.maxMessages = shortTermConfig?.maxMessages ?? DEFAULT_MAX_MESSAGES;
        this.maxTokens = shortTermConfig?.maxTokens ?? DEFAULT_MAX_TOKENS;

        // Store long-term memory configuration
        this.longTermConfig = config?.longTerm;

        // Initialize token estimator
        this.tokenEstimator = new TokenEstimator();

        this.logger.debug('MemoryManager initialized', {
            maxMessages: this.maxMessages,
            maxTokens: this.maxTokens,
            hasLongTermMemory: !!this.longTermConfig,
        });
    }

    /**
     * Adds a message to the conversation history.
     * 
     * After adding the message, automatically prunes memory if limits are exceeded.
     * 
     * @param message - Message to add to history
     * 
     * @example
     * ```typescript
     * memoryManager.addMessage({
     *   role: 'user',
     *   content: [{ text: 'What is the weather?' }]
     * });
     * ```
     */
    addMessage(message: Message): void {
        this.shortTermMemory.push(message);

        this.logger.debug('Message added to memory', {
            role: message.role,
            contentBlocks: message.content.length,
            totalMessages: this.shortTermMemory.length,
        });

        // Prune memory if limits exceeded
        this.pruneMemory();
    }

    /**
     * Retrieves all messages from the conversation history.
     * 
     * @returns Array of messages in chronological order
     * 
     * @example
     * ```typescript
     * const history = memoryManager.getMessages();
     * console.log(`Conversation has ${history.length} messages`);
     * ```
     */
    getMessages(): Message[] {
        return [...this.shortTermMemory];
    }

    /**
     * Clears all messages from short-term memory.
     * 
     * This does not affect long-term storage. Use this to reset
     * the conversation context for a new conversation.
     * 
     * @example
     * ```typescript
     * memoryManager.clear();
     * console.log('Memory cleared');
     * ```
     */
    clear(): void {
        const previousCount = this.shortTermMemory.length;
        this.shortTermMemory = [];

        this.logger.info('Short-term memory cleared', {
            messagesCleared: previousCount,
        });
    }

    /**
     * Loads conversation history from long-term storage.
     * 
     * Fetches messages using the configured fetch callback and replaces
     * the current short-term memory. If fetch fails, logs error but does
     * not throw to avoid interrupting conversation flow.
     * 
     * @param sessionId - Unique identifier for the conversation session
     * @throws {MemoryError} If long-term memory is not configured
     * 
     * @example
     * ```typescript
     * await memoryManager.loadSession('user-123-session-456');
     * ```
     */
    async loadSession(sessionId: string): Promise<void> {
        if (!this.longTermConfig) {
            throw new MemoryError(
                'Long-term memory not configured',
                ErrorCode.MEMORY_ERROR,
                undefined,
                { sessionId }
            );
        }

        try {
            this.logger.debug('Loading session from long-term memory', { sessionId });

            const messages = await this.longTermConfig.fetch(sessionId);

            this.shortTermMemory = messages;

            // Prune loaded messages if they exceed limits
            this.pruneMemory();

            this.logger.info('Session loaded from long-term memory', {
                sessionId,
                messagesLoaded: messages.length,
                messagesAfterPruning: this.shortTermMemory.length,
            });
        } catch (error) {
            const memoryError = new MemoryError(
                `Failed to fetch conversation history for session: ${sessionId}`,
                ErrorCode.MEMORY_FETCH_ERROR,
                error as Error,
                { sessionId }
            );

            this.logger.error('Failed to load session from long-term memory', {
                error: memoryError.toJSON(),
            });

            // Don't throw - allow conversation to continue with empty history
            // This prevents fetch failures from breaking the conversation flow
        }
    }

    /**
     * Saves conversation history to long-term storage.
     * 
     * Persists current short-term memory using the configured save callback.
     * If save fails, logs error but does not throw to avoid interrupting
     * conversation flow.
     * 
     * @param sessionId - Unique identifier for the conversation session
     * @throws {MemoryError} If long-term memory is not configured
     * 
     * @example
     * ```typescript
     * await memoryManager.saveSession('user-123-session-456');
     * ```
     */
    async saveSession(sessionId: string): Promise<void> {
        if (!this.longTermConfig) {
            throw new MemoryError(
                'Long-term memory not configured',
                ErrorCode.MEMORY_ERROR,
                undefined,
                { sessionId }
            );
        }

        try {
            this.logger.debug('Saving session to long-term memory', {
                sessionId,
                messageCount: this.shortTermMemory.length,
            });

            await this.longTermConfig.save(sessionId, this.shortTermMemory);

            this.logger.info('Session saved to long-term memory', {
                sessionId,
                messagesSaved: this.shortTermMemory.length,
            });
        } catch (error) {
            const memoryError = new MemoryError(
                `Failed to save conversation history for session: ${sessionId}`,
                ErrorCode.MEMORY_SAVE_ERROR,
                error as Error,
                { sessionId, messageCount: this.shortTermMemory.length }
            );

            this.logger.error('Failed to save session to long-term memory', {
                error: memoryError.toJSON(),
            });

            // Don't throw - allow conversation to continue
            // This prevents save failures from breaking the conversation flow
        }
    }

    /**
     * Prunes memory to enforce message and token limits.
     * 
     * Removes oldest messages first until both limits are satisfied.
     * This method is called automatically after adding messages.
     * 
     * @private
     */
    private pruneMemory(): void {
        const initialCount = this.shortTermMemory.length;

        // First, prune by message count
        if (this.shortTermMemory.length > this.maxMessages) {
            const messagesToRemove = this.shortTermMemory.length - this.maxMessages;
            this.shortTermMemory = this.shortTermMemory.slice(messagesToRemove);

            this.logger.debug('Memory pruned by message count', {
                messagesRemoved: messagesToRemove,
                remainingMessages: this.shortTermMemory.length,
            });
        }

        // Then, prune by token count
        let currentTokens = this.estimateTokens(this.shortTermMemory);
        let pruneCount = 0;

        while (currentTokens > this.maxTokens && this.shortTermMemory.length > 0) {
            this.shortTermMemory.shift(); // Remove oldest message
            pruneCount++;
            currentTokens = this.estimateTokens(this.shortTermMemory);
        }

        if (pruneCount > 0) {
            this.logger.debug('Memory pruned by token count', {
                messagesRemoved: pruneCount,
                remainingMessages: this.shortTermMemory.length,
                estimatedTokens: currentTokens,
            });
        }

        // Log warning if significant pruning occurred
        const totalPruned = initialCount - this.shortTermMemory.length;
        if (totalPruned > 0) {
            this.logger.warn('Memory limit reached, messages pruned', {
                messagesPruned: totalPruned,
                remainingMessages: this.shortTermMemory.length,
                maxMessages: this.maxMessages,
                maxTokens: this.maxTokens,
            });
        }
    }

    /**
     * Estimates the total token count for an array of messages.
     * 
     * Uses the TokenEstimator utility for consistent token counting.
     * This is a rough estimate and may not match exact model tokenization,
     * but is sufficient for memory management purposes.
     * 
     * @param messages - Array of messages to estimate tokens for
     * @returns Approximate token count
     * 
     * @private
     */
    private estimateTokens(messages: Message[]): number {
        return this.tokenEstimator.estimateMessages(messages);
    }

    /**
     * Gets the current estimated token count for conversation history.
     * 
     * @returns Estimated token count for current conversation history
     * 
     * @example
     * ```typescript
     * const currentTokens = memoryManager.getEstimatedTokens();
     * console.log(`Current conversation uses ~${currentTokens} tokens`);
     * ```
     */
    getEstimatedTokens(): number {
        return this.estimateTokens(this.shortTermMemory);
    }
}
