import type { Message, ContentBlock } from '../config/message-types.js';

export interface TokenEstimationConfig {
    /** @default 4 */
    charsPerToken?: number;
    /** @default 1000 */
    imageTokens?: number;
    /** @default 500 */
    documentTokens?: number;
    /** @default 2000 */
    videoTokens?: number;
    /** @default 4 */
    messageOverheadTokens?: number;
}

const DEFAULT_CONFIG: Required<TokenEstimationConfig> = {
    charsPerToken: 4,
    imageTokens: 1000,
    documentTokens: 500,
    videoTokens: 2000,
    messageOverheadTokens: 4,
};

/** Estimates token counts for conversation history using configurable approximations. */
export class TokenEstimator {
    private readonly config: Required<TokenEstimationConfig>;

    constructor(config?: TokenEstimationConfig) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };
    }

    estimateText(text: string): number {
        return Math.ceil(text.length / this.config.charsPerToken);
    }

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

    estimateMessage(message: Message): number {
        let tokens = this.config.messageOverheadTokens;

        for (const content of message.content) {
            tokens += this.estimateContentBlock(content);
        }

        return tokens;
    }

    estimateMessages(messages: Message[]): number {
        let totalTokens = 0;

        for (const message of messages) {
            totalTokens += this.estimateMessage(message);
        }

        return totalTokens;
    }

    updateConfig(config: Partial<TokenEstimationConfig>): void {
        Object.assign(this.config, config);
    }

    getConfig(): Readonly<Required<TokenEstimationConfig>> {
        return { ...this.config };
    }
}

export function createTokenEstimator(config?: TokenEstimationConfig): TokenEstimator {
    return new TokenEstimator(config);
}

export function estimateTextTokens(text: string): number {
    return Math.ceil(text.length / DEFAULT_CONFIG.charsPerToken);
}

export function estimateMessageTokens(messages: Message[]): number {
    const estimator = new TokenEstimator();
    return estimator.estimateMessages(messages);
}
