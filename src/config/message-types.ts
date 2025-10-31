/**
 * Message and content block type definitions matching Bedrock API structure.
 *
 * These types define the structure of messages exchanged between users,
 * the Agent, and the Bedrock API.
 */

/**
 * Represents a single message in a conversation.
 */
export interface Message {
    /**
     * Role of the message sender.
     */
    role: 'user' | 'assistant';

    /**
     * Content blocks that make up the message.
     * Can include text, images, documents, videos, tool uses, and tool results.
     */
    content: ContentBlock[];
}

/**
 * Union type representing all possible content block types.
 */
export type ContentBlock =
    | TextContent
    | ImageContent
    | DocumentContent
    | VideoContent
    | ToolUseContent
    | ToolResultContent;

/**
 * Text content block.
 */
export interface TextContent {
    /**
     * Plain text content.
     */
    text: string;
}

/**
 * Image content block for multimodal conversations.
 */
export interface ImageContent {
    image: {
        /**
         * Image format.
         */
        format: 'png' | 'jpeg' | 'gif' | 'webp';

        /**
         * Image source - either raw bytes or S3 location.
         */
        source: {
            /**
             * Raw image bytes (base64 encoded when serialized).
             */
            bytes?: Uint8Array;

            /**
             * S3 location of the image.
             */
            s3Location?: S3Location;
        };
    };
}

/**
 * Document content block for document processing.
 */
export interface DocumentContent {
    document: {
        /**
         * Document format.
         */
        format: 'pdf' | 'csv' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'html' | 'txt' | 'md';

        /**
         * Document name for reference.
         */
        name: string;

        /**
         * Document source - either raw bytes or S3 location.
         */
        source: {
            /**
             * Raw document bytes.
             */
            bytes?: Uint8Array;

            /**
             * S3 location of the document.
             */
            s3Location?: S3Location;
        };
    };
}

/**
 * Video content block for video processing.
 */
export interface VideoContent {
    video: {
        /**
         * Video format.
         */
        format: 'mp4' | 'mov' | 'avi' | 'flv' | 'mkv' | 'webm';

        /**
         * Video source - either raw bytes or S3 location.
         */
        source: {
            /**
             * Raw video bytes.
             */
            bytes?: Uint8Array;

            /**
             * S3 location of the video.
             */
            s3Location?: S3Location;
        };
    };
}

/**
 * Tool use content block representing a model's request to invoke a tool.
 */
export interface ToolUseContent {
    toolUse: {
        /**
         * Unique identifier for this tool use request.
         * Used to correlate with tool result.
         */
        toolUseId: string;

        /**
         * Name of the tool to invoke.
         */
        name: string;

        /**
         * Input parameters for the tool.
         */
        input: any;
    };
}

/**
 * Tool result content block containing the output of a tool execution.
 */
export interface ToolResultContent {
    toolResult: {
        /**
         * Identifier matching the original tool use request.
         */
        toolUseId: string;

        /**
         * Result content from tool execution.
         */
        content: ContentBlock[];

        /**
         * Status of the tool execution.
         */
        status?: 'success' | 'error';
    };
}

/**
 * S3 location reference for content stored in S3.
 */
export interface S3Location {
    /**
     * S3 URI in format s3://bucket-name/key.
     */
    uri: string;

    /**
     * Optional AWS account ID of the bucket owner.
     * Required for cross-account access.
     */
    bucketOwner?: string;
}

/**
 * Input for a conversation turn.
 */
export interface ConverseInput {
    /**
     * User message - can be simple text or array of content blocks.
     */
    message: string | ContentBlock[];

    /**
     * Optional session identifier for long-term memory persistence.
     */
    sessionId?: string;

    /**
     * Optional system prompts to guide model behavior.
     */
    systemPrompts?: string[];

    /**
     * Optional additional context for the conversation.
     */
    additionalContext?: Record<string, any>;
}

/**
 * Response from a conversation turn.
 */
export interface ConverseResponse {
    /**
     * Generated message text.
     */
    message: string;

    /**
     * Reason why generation stopped.
     */
    stopReason: StopReason;

    /**
     * Token usage statistics.
     */
    usage: TokenUsage;

    /**
     * Tool calls made by the model (if any).
     */
    toolCalls?: ToolCall[];

    /**
     * Guardrail action taken (if guardrail is configured).
     */
    guardrailAction?: GuardrailAction;
}

/**
 * Reason why model generation stopped.
 */
export type StopReason =
    | 'end_turn'
    | 'max_tokens'
    | 'stop_sequence'
    | 'tool_use'
    | 'content_filtered'
    | 'guardrail_intervened';

/**
 * Token usage statistics for a conversation turn.
 */
export interface TokenUsage {
    /**
     * Number of tokens in the input.
     */
    inputTokens: number;

    /**
     * Number of tokens in the output.
     */
    outputTokens: number;

    /**
     * Total tokens used (input + output).
     */
    totalTokens: number;
}

/**
 * Information about a tool call made by the model.
 */
export interface ToolCall {
    /**
     * Unique identifier for the tool call.
     */
    toolUseId: string;

    /**
     * Name of the tool called.
     */
    name: string;

    /**
     * Input provided to the tool.
     */
    input: any;
}

/**
 * Guardrail action information.
 */
export interface GuardrailAction {
    /**
     * Action taken by the guardrail.
     */
    action: 'INTERVENED' | 'NONE';

    /**
     * Optional trace information about the guardrail evaluation.
     */
    trace?: any;
}
