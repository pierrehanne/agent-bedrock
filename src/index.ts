/**
 * Agent Bedrock
 * 
 * A JavaScript framework for building conversational AI agents with AWS Bedrock.
 * This framework provides a simplified interface for creating agents that leverage
 * the Bedrock Runtime ConverseStream API with built-in observability through AWS Powertools.
 * 
 * @packageDocumentation
 */

// Configuration types
export type {
    AgentConfig,
    ModelConfig,
    GuardrailConfig,
    MemoryConfig,
    ShortTermMemoryConfig,
    LongTermMemoryConfig,
    RetryConfig,
} from './config/types.js';

// Message and content types
export type {
    Message,
    ContentBlock,
    TextContent,
    ImageContent,
    DocumentContent,
    VideoContent,
    ToolUseContent,
    ToolResultContent,
    S3Location,
    ConverseInput,
    ConverseResponse,
    StopReason,
    TokenUsage,
    ToolCall,
    GuardrailAction,
} from './config/message-types.js';

// Tool types
export type {
    ToolDefinition,
    JSONSchema,
    JSONSchemaProperty,
    ToolConfig,
    ToolSpec,
    ToolChoice,
    ToolUse,
    ToolResult,
} from './tools/types.js';

// MCP types and classes
export type {
    McpServerConfig,
    McpAuthConfig,
    McpReconnectConfig,
    McpToolFilter,
    McpTool,
    McpResource,
    ResourceContent,
    McpServerInfo,
    ConnectionStatus,
} from './mcp/types.js';

export { McpClientManager } from './mcp/client-manager.js';
export { McpServerConnection } from './mcp/connection.js';
export {
    filterTools,
    hasFilterRules,
    validateToolFilter,
} from './mcp/filters.js';
export type { FilterResult } from './mcp/filters.js';

// Stream types
export type {
    StreamEvent,
    MessageStartEvent,
    ContentBlockStartEvent,
    ContentBlockDeltaEvent,
    ContentBlockStopEvent,
    MessageStopEvent,
    MetadataEvent,
    ErrorEvent,
    ContentDelta,
    StreamHandlerConfig,
    StreamState,
} from './stream/types.js';

// Memory types and classes
export type {
    MemoryState,
    PruneOptions,
    PruneResult,
    MemoryOperationResult,
} from './memory/types.js';

export { MemoryManager } from './memory/manager.js';

// Tool executor
export { ToolExecutor } from './tools/executor.js';

// Stream handler
export { StreamHandler } from './stream/handler.js';

// Error types and classes
export {
    ErrorCode,
    BedrockAgentError,
    ValidationError,
    APIError,
    ToolExecutionError,
    MemoryError,
    StreamError,
} from './errors/index.js';

// Multimodal content helpers
export {
    createImageFromBytes,
    createImageFromS3,
    createDocumentFromBytes,
    createDocumentFromS3,
    createVideoFromBytes,
    createVideoFromS3,
} from './utils/multimodal.js';

export type {
    ImageFromBytesOptions,
    ImageFromS3Options,
    DocumentFromBytesOptions,
    DocumentFromS3Options,
    VideoFromBytesOptions,
    VideoFromS3Options,
} from './utils/multimodal.js';

// Token estimation utilities
export {
    TokenEstimator,
    createTokenEstimator,
    estimateTextTokens,
    estimateMessageTokens,
} from './utils/tokens.js';

export type {
    TokenEstimationConfig,
} from './utils/tokens.js';

// Agent class - main interface
export { Agent } from './agent.js';

// Default export
export { default } from './agent.js';
