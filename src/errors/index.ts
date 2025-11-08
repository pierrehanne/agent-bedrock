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

export class BedrockAgentError extends Error {
    public readonly code: ErrorCode;
    public readonly cause?: Error;
    public readonly context?: Record<string, any>;
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

export class ValidationError extends BedrockAgentError {
    constructor(message: string, context?: Record<string, any>, cause?: Error) {
        super(message, ErrorCode.VALIDATION_ERROR, cause, context);
        this.name = 'ValidationError';
    }
}

export class APIError extends BedrockAgentError {
    public readonly statusCode?: number;
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

    private static isRetryable(statusCode?: number): boolean {
        if (!statusCode) return false;
        return statusCode === 429 || statusCode === 503 || statusCode === 504;
    }
}

export class ToolExecutionError extends BedrockAgentError {
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

export class McpConnectionError extends BedrockAgentError {
    public readonly serverName: string;
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

export class McpToolExecutionError extends BedrockAgentError {
    public readonly serverName: string;
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

export class McpResourceError extends BedrockAgentError {
    public readonly serverName: string;
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
