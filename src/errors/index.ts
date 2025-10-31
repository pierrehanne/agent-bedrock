/**
 * Error classes and types for the Agent Bedrock.
 *
 * This module provides a comprehensive error hierarchy for handling
 * various failure scenarios in the framework.
 */

/**
 * Error codes for different failure scenarios.
 */
export enum ErrorCode {
    // Validation errors (1xxx)
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_CONFIG = 'INVALID_CONFIG',
    INVALID_INPUT = 'INVALID_INPUT',
    INVALID_TOOL_DEFINITION = 'INVALID_TOOL_DEFINITION',
    INVALID_CONTENT_BLOCK = 'INVALID_CONTENT_BLOCK',

    // API errors (2xxx)
    API_ERROR = 'API_ERROR',
    API_TIMEOUT = 'API_TIMEOUT',
    API_THROTTLED = 'API_THROTTLED',
    API_UNAUTHORIZED = 'API_UNAUTHORIZED',
    API_FORBIDDEN = 'API_FORBIDDEN',
    API_NOT_FOUND = 'API_NOT_FOUND',
    API_INTERNAL_ERROR = 'API_INTERNAL_ERROR',

    // Tool errors (3xxx)
    TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
    TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
    TOOL_VALIDATION_ERROR = 'TOOL_VALIDATION_ERROR',
    TOOL_TIMEOUT = 'TOOL_TIMEOUT',

    // Memory errors (4xxx)
    MEMORY_ERROR = 'MEMORY_ERROR',
    MEMORY_FETCH_ERROR = 'MEMORY_FETCH_ERROR',
    MEMORY_SAVE_ERROR = 'MEMORY_SAVE_ERROR',
    MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',

    // Stream errors (5xxx)
    STREAM_ERROR = 'STREAM_ERROR',
    STREAM_INTERRUPTED = 'STREAM_INTERRUPTED',
    STREAM_TIMEOUT = 'STREAM_TIMEOUT',
    STREAM_PARSE_ERROR = 'STREAM_PARSE_ERROR',

    // MCP errors (6xxx)
    MCP_CONNECTION_ERROR = 'MCP_CONNECTION_ERROR',
    MCP_TOOL_EXECUTION_ERROR = 'MCP_TOOL_EXECUTION_ERROR',
    MCP_RESOURCE_ERROR = 'MCP_RESOURCE_ERROR',
    MCP_AUTHENTICATION_ERROR = 'MCP_AUTHENTICATION_ERROR',
    MCP_SERVER_UNAVAILABLE = 'MCP_SERVER_UNAVAILABLE',

    // General errors (9xxx)
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
}

/**
 * Base error class for all Agent Bedrock errors.
 *
 * @example
 * ```typescript
 * throw new BedrockAgentError(
 *   'Configuration validation failed',
 *   ErrorCode.INVALID_CONFIG
 * );
 * ```
 */
export class BedrockAgentError extends Error {
    /**
     * Error code for programmatic error handling.
     */
    public readonly code: ErrorCode;

    /**
     * Original error that caused this error (if any).
     */
    public readonly cause?: Error;

    /**
     * Additional context about the error.
     */
    public readonly context?: Record<string, any>;

    /**
     * Timestamp when the error occurred.
     */
    public readonly timestamp: Date;

    constructor(
        message: string,
        code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
        cause?: Error,
        context?: Record<string, any>,
    ) {
        super(message);
        this.name = 'BedrockAgentError';
        this.code = code;
        this.cause = cause;
        this.context = context;
        this.timestamp = new Date();

        // Maintains proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert error to JSON for logging.
     */
    toJSON(): Record<string, any> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
            cause: this.cause
                ? {
                      name: this.cause.name,
                      message: this.cause.message,
                  }
                : undefined,
        };
    }
}

/**
 * Error thrown when input validation fails.
 *
 * @example
 * ```typescript
 * throw new ValidationError(
 *   'modelId is required',
 *   { field: 'modelId' }
 * );
 * ```
 */
export class ValidationError extends BedrockAgentError {
    constructor(message: string, context?: Record<string, any>, cause?: Error) {
        super(message, ErrorCode.VALIDATION_ERROR, cause, context);
        this.name = 'ValidationError';
    }
}

/**
 * Error thrown when Bedrock API calls fail.
 *
 * @example
 * ```typescript
 * throw new APIError(
 *   'Bedrock API call failed',
 *   429,
 *   originalError,
 *   { modelId: 'claude-3' }
 * );
 * ```
 */
export class APIError extends BedrockAgentError {
    /**
     * HTTP status code from the API response.
     */
    public readonly statusCode?: number;

    /**
     * Whether this error is retryable.
     */
    public readonly retryable: boolean;

    constructor(
        message: string,
        statusCode?: number,
        cause?: Error,
        context?: Record<string, any>,
    ) {
        const code = APIError.getErrorCode(statusCode);
        super(message, code, cause, context);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.retryable = APIError.isRetryable(statusCode);
    }

    /**
     * Determine error code based on status code.
     */
    private static getErrorCode(statusCode?: number): ErrorCode {
        if (!statusCode) return ErrorCode.API_ERROR;

        switch (statusCode) {
            case 401:
                return ErrorCode.API_UNAUTHORIZED;
            case 403:
                return ErrorCode.API_FORBIDDEN;
            case 404:
                return ErrorCode.API_NOT_FOUND;
            case 429:
                return ErrorCode.API_THROTTLED;
            case 504:
                return ErrorCode.API_TIMEOUT;
            default:
                return statusCode >= 500 ? ErrorCode.API_INTERNAL_ERROR : ErrorCode.API_ERROR;
        }
    }

    /**
     * Determine if error is retryable based on status code.
     */
    private static isRetryable(statusCode?: number): boolean {
        if (!statusCode) return false;
        return statusCode === 429 || statusCode === 503 || statusCode === 504;
    }
}

/**
 * Error thrown when tool execution fails.
 *
 * @example
 * ```typescript
 * throw new ToolExecutionError(
 *   'get_weather',
 *   'API key not configured',
 *   originalError
 * );
 * ```
 */
export class ToolExecutionError extends BedrockAgentError {
    /**
     * Name of the tool that failed.
     */
    public readonly toolName: string;

    constructor(toolName: string, message: string, cause?: Error, context?: Record<string, any>) {
        super(
            `Tool execution failed: ${toolName} - ${message}`,
            ErrorCode.TOOL_EXECUTION_ERROR,
            cause,
            { ...context, toolName },
        );
        this.name = 'ToolExecutionError';
        this.toolName = toolName;
    }
}

/**
 * Error thrown when memory operations fail.
 *
 * @example
 * ```typescript
 * throw new MemoryError(
 *   'Failed to fetch conversation history',
 *   ErrorCode.MEMORY_FETCH_ERROR,
 *   originalError
 * );
 * ```
 */
export class MemoryError extends BedrockAgentError {
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.MEMORY_ERROR,
        cause?: Error,
        context?: Record<string, any>,
    ) {
        super(message, code, cause, context);
        this.name = 'MemoryError';
    }
}

/**
 * Error thrown when streaming operations fail.
 *
 * @example
 * ```typescript
 * throw new StreamError(
 *   'Stream interrupted unexpectedly',
 *   ErrorCode.STREAM_INTERRUPTED
 * );
 * ```
 */
export class StreamError extends BedrockAgentError {
    constructor(
        message: string,
        code: ErrorCode = ErrorCode.STREAM_ERROR,
        cause?: Error,
        context?: Record<string, any>,
    ) {
        super(message, code, cause, context);
        this.name = 'StreamError';
    }
}

/**
 * Error thrown when MCP connection operations fail.
 *
 * @example
 * ```typescript
 * throw new McpConnectionError(
 *   'weather-service',
 *   'Failed to connect to MCP server',
 *   originalError
 * );
 * ```
 */
export class McpConnectionError extends BedrockAgentError {
    /**
     * Name of the MCP server that failed.
     */
    public readonly serverName: string;

    /**
     * Operation that was being performed when the error occurred.
     */
    public readonly operation?: string;

    constructor(serverName: string, message: string, cause?: Error, context?: Record<string, any>) {
        super(
            `MCP connection error [${serverName}]: ${message}`,
            ErrorCode.MCP_CONNECTION_ERROR,
            cause,
            { ...context, serverName },
        );
        this.name = 'McpConnectionError';
        this.serverName = serverName;
        this.operation = context?.operation;
    }
}

/**
 * Error thrown when MCP tool execution fails.
 *
 * @example
 * ```typescript
 * throw new McpToolExecutionError(
 *   'weather-service',
 *   'get_weather',
 *   'API key not configured',
 *   originalError
 * );
 * ```
 */
export class McpToolExecutionError extends BedrockAgentError {
    /**
     * Name of the MCP server where the tool failed.
     */
    public readonly serverName: string;

    /**
     * Name of the tool that failed.
     */
    public readonly toolName: string;

    constructor(
        serverName: string,
        toolName: string,
        message: string,
        cause?: Error,
        context?: Record<string, any>,
    ) {
        super(
            `MCP tool execution error [${serverName}/${toolName}]: ${message}`,
            ErrorCode.MCP_TOOL_EXECUTION_ERROR,
            cause,
            { ...context, serverName, toolName },
        );
        this.name = 'McpToolExecutionError';
        this.serverName = serverName;
        this.toolName = toolName;
    }
}

/**
 * Error thrown when MCP resource operations fail.
 *
 * @example
 * ```typescript
 * throw new McpResourceError(
 *   'database-service',
 *   'db://customers/schema',
 *   'Resource not found',
 *   originalError
 * );
 * ```
 */
export class McpResourceError extends BedrockAgentError {
    /**
     * Name of the MCP server where the resource operation failed.
     */
    public readonly serverName: string;

    /**
     * URI of the resource that failed.
     */
    public readonly resourceUri: string;

    constructor(
        serverName: string,
        resourceUri: string,
        message: string,
        cause?: Error,
        context?: Record<string, any>,
    ) {
        super(
            `MCP resource error [${String(serverName)}/${String(resourceUri)}]: ${message}`,
            ErrorCode.MCP_RESOURCE_ERROR,
            cause,
            { ...context, serverName, resourceUri } as Record<string, unknown>,
        );
        this.name = 'McpResourceError';
        this.serverName = serverName;
        this.resourceUri = resourceUri;
    }
}
