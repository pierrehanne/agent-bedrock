/**
 * Token estimation utilities for conversation history management.
 * 
 * This module provides approximate token counting for text and multimodal content.
 * The estimates are used for memory pruning decisions and are not exact tokenization
 * but sufficient for memory management purposes.
 */

import type { Message, ContentBlock } from '../config/message-types.js';

/**
 * Configuration for token estimation.
 */
export interface TokenEstimationConfig {
    /**
     * Average characters per token for text content.
     * Default: 4 (common approximation for English text)
     */
    charsPerToken?: number;

    /**
     * Estimated tokens for image content.
     * Default: 1000
     */
    imageTokens?: number;

    /**
     * Estimated tokens for document content.
     * Default: 500
     */
    documentTokens?: number;

    /**
     * Estimated tokens for video content.
     * Default: 2000
     */
    videoTokens?: number;

    /**
     * Base tokens for message structure overhead.
     * Default: 4
     */
    messageOverheadTokens?: number;
}

/**
 * Default token estimation configuration.
 */
const DEFAULT_CONFIG: Required<TokenEstimationConfig> = {
    charsPerToken: 4,
    imageTokens: 1000,
    documentTokens: 500,
    videoTokens: 2000,
    messageOverheadTokens: 4,
};

/**
 * Token estimation utility class.
 * 
 * Provides methods for estimating token counts in conversation history.
 * Uses configurable approximations for different content types.
 * 
 * @example
 * ```typescript
 * const estimator = new TokenEstimator();
 * 
 * const tokens = estimator.estimateText('Hello, world!');
 * console.log(`Estimated tokens: ${tokens}`);
 * 
 * const messageTokens = estimator.estimateMessage({
 *   role: 'user',
 *   content: [{ text: 'What is the weather?' }]
 * });
 * ```
 */
export class TokenEstimator {
    private readonly config: Required<TokenEstimationConfig>;

    /**
     * Creates a new TokenEstimator instance.
     * 
     * @param config - Optional configuration for token estimation
     */
    constructor(config?: TokenEstimationConfig) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };
    }

    /**
     * Estimates token count for a text string.
     * 
     * Uses a simple character-to-token ratio approximation.
     * 
     * @param text - Text to estimate tokens for
     * @returns Estimated token count
     * 
     * @example
     * ```typescript
     * const tokens = estimator.estimateText('Hello, world!');
     * // Returns approximately 3 tokens
     * ```
     */
    estimateText(text: string): number {
        return Math.ceil(text.length / this.config.charsPerToken);
    }

    /**
     * Estimates token count for a single content block.
     * 
     * Handles all content types: text, image, document, video, tool use, and tool result.
     * 
     * @param content - Content block to estimate tokens for
     * @returns Estimated token count
     * 
     * @example
     * ```typescript
     * const tokens = estimator.estimateContentBlock({ text: 'Hello!' });
     * ```
     */
    estimateContentBlock(content: ContentBlock): number {
        if ('text' in content) {
            return this.estimateText(content.text);
        }

        if ('image' in content) {
            return this.config.imageTokens;
        }

        if ('document' in content) {
            return this.config.documentTokens;
        }

        if ('video' in content) {
            return this.config.videoTokens;
        }

        if ('toolUse' in content) {
            const toolUse = content.toolUse;
            let tokens = this.estimateText(toolUse.name);
            tokens += this.estimateText(JSON.stringify(toolUse.input));
            return tokens;
        }

        if ('toolResult' in content) {
            const toolResult = content.toolResult;
            // Recursively estimate tokens for nested content
            let tokens = 0;
            for (const nestedContent of toolResult.content) {
                tokens += this.estimateContentBlock(nestedContent);
            }
            return tokens;
        }

        // Unknown content type, return minimal estimate
        return 1;
    }

    /**
     * Estimates token count for a single message.
     * 
     * Includes message overhead and all content blocks.
     * 
     * @param message - Message to estimate tokens for
     * @returns Estimated token count
     * 
     * @example
     * ```typescript
     * const tokens = estimator.estimateMessage({
     *   role: 'user',
     *   content: [{ text: 'What is the weather?' }]
     * });
     * ```
     */
    estimateMessage(message: Message): number {
        let tokens = this.config.messageOverheadTokens;

        for (const content of message.content) {
            tokens += this.estimateContentBlock(content);
        }

        return tokens;
    }

    /**
     * Estimates total token count for an array of messages.
     * 
     * This is the primary method used for conversation history token estimation.
     * 
     * @param messages - Array of messages to estimate tokens for
     * @returns Total estimated token count
     * 
     * @example
     * ```typescript
     * const history = [
     *   { role: 'user', content: [{ text: 'Hello' }] },
     *   { role: 'assistant', content: [{ text: 'Hi there!' }] }
     * ];
     * const tokens = estimator.estimateMessages(history);
     * console.log(`Total tokens: ${tokens}`);
     * ```
     */
    estimateMessages(messages: Message[]): number {
        let totalTokens = 0;

        for (const message of messages) {
            totalTokens += this.estimateMessage(message);
        }

        return totalTokens;
    }

    /**
     * Updates the token estimation configuration.
     * 
     * Allows runtime adjustment of estimation parameters.
     * 
     * @param config - Partial configuration to update
     * 
     * @example
     * ```typescript
     * estimator.updateConfig({ charsPerToken: 3 });
     * ```
     */
    updateConfig(config: Partial<TokenEstimationConfig>): void {
        Object.assign(this.config, config);
    }

    /**
     * Gets the current token estimation configuration.
     * 
     * @returns Current configuration
     */
    getConfig(): Readonly<Required<TokenEstimationConfig>> {
        return { ...this.config };
    }
}

/**
 * Creates a default token estimator instance.
 * 
 * Convenience function for creating an estimator with default configuration.
 * 
 * @returns TokenEstimator instance with default configuration
 * 
 * @example
 * ```typescript
 * const estimator = createTokenEstimator();
 * const tokens = estimator.estimateText('Hello, world!');
 * ```
 */
export function createTokenEstimator(config?: TokenEstimationConfig): TokenEstimator {
    return new TokenEstimator(config);
}

/**
 * Estimates token count for text using default configuration.
 * 
 * Convenience function for quick token estimation without creating an instance.
 * 
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 * 
 * @example
 * ```typescript
 * const tokens = estimateTextTokens('Hello, world!');
 * ```
 */
export function estimateTextTokens(text: string): number {
    return Math.ceil(text.length / DEFAULT_CONFIG.charsPerToken);
}

/**
 * Estimates token count for messages using default configuration.
 * 
 * Convenience function for quick message token estimation without creating an instance.
 * 
 * @param messages - Messages to estimate tokens for
 * @returns Estimated token count
 * 
 * @example
 * ```typescript
 * const tokens = estimateMessageTokens([
 *   { role: 'user', content: [{ text: 'Hello' }] }
 * ]);
 * ```
 */
export function estimateMessageTokens(messages: Message[]): number {
    const estimator = new TokenEstimator();
    return estimator.estimateMessages(messages);
}
