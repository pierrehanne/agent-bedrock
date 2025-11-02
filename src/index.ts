/**
 * Agent Bedrock
 *
 * A professional TypeScript framework for building conversational AI agents with AWS Bedrock.
 * Provides a simplified interface for creating agents that leverage the Bedrock Runtime
 * ConverseStream API with built-in observability through AWS Powertools.
 *
 * @packageDocumentation
 * @module agent-bedrock
 */

// ============================================================================
// Core Agent
// ============================================================================
export { Agent } from './agent.js';
export { default } from './agent.js';

// ============================================================================
// Configuration
// ============================================================================
export type {
    AgentConfig,
    ModelConfig,
    GuardrailConfig,
    MemoryConfig,
    ShortTermMemoryConfig,
    LongTermMemoryConfig,
    RetryConfig,
} from './config/index.js';

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
} from './config/index.js';

// ============================================================================
// Tools
// ============================================================================
export { ToolExecutor } from './tools/index.js';
export type {
    ToolDefinition,
    JSONSchema,
    JSONSchemaProperty,
    ToolConfig,
    ToolSpec,
    ToolChoice,
    ToolUse,
    ToolResult,
} from './tools/index.js';

// ============================================================================
// Model Context Protocol (MCP)
// ============================================================================
export { McpClientManager, McpServerConnection } from './mcp/index.js';
export { filterTools, hasFilterRules, validateToolFilter } from './mcp/index.js';
export type { FilterResult } from './mcp/index.js';

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
} from './mcp/index.js';

// ============================================================================
// Streaming
// ============================================================================
export { StreamHandler } from './stream/index.js';
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
} from './stream/index.js';

// ============================================================================
// Memory Management
// ============================================================================
export { MemoryManager } from './memory/index.js';
export type {
    MemoryState,
    PruneOptions,
    PruneResult,
    MemoryOperationResult,
} from './memory/index.js';

// ============================================================================
// Observability
// ============================================================================
export { createLogger, createMetrics, createTracer } from './observability/index.js';

// ============================================================================
// Error Handling
// ============================================================================
export {
    ErrorCode,
    BedrockAgentError,
    ValidationError,
    APIError,
    ToolExecutionError,
    MemoryError,
    StreamError,
} from './errors/index.js';

// ============================================================================
// Utilities
// ============================================================================

// Multimodal content helpers
export {
    createImageFromBytes,
    createImageFromS3,
    createDocumentFromBytes,
    createDocumentFromS3,
    createVideoFromBytes,
    createVideoFromS3,
} from './utils/index.js';

export type {
    ImageFromBytesOptions,
    ImageFromS3Options,
    DocumentFromBytesOptions,
    DocumentFromS3Options,
    VideoFromBytesOptions,
    VideoFromS3Options,
} from './utils/index.js';

// Token estimation
export {
    TokenEstimator,
    createTokenEstimator,
    estimateTextTokens,
    estimateMessageTokens,
} from './utils/index.js';

export type { TokenEstimationConfig } from './utils/index.js';

// Sanitization
export { sanitizeString, sanitizeObject, sanitizeLogData, createSanitizer } from './utils/index.js';
export type { SanitizeConfig } from './utils/index.js';

// Retry logic (if exported from utils)
// export { withRetry, createRetryConfig } from './utils/index.js';

// ============================================================================
// Constants
// ============================================================================
export { DEFAULTS, MODELS, FORMATS, HTTP_STATUS } from './constants/index.js';
