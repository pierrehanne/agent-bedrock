import { describe, it, expect } from 'vitest';
import {
    BedrockAgentError,
    ValidationError,
    APIError,
    ToolExecutionError,
    MemoryError,
    ErrorCode,
} from '../../../src/errors/index.js';

describe('Error Classes', () => {
    describe('BedrockAgentError', () => {
        it('should create error with message and code', () => {
            const error = new BedrockAgentError('Test error', ErrorCode.UNKNOWN_ERROR);

            expect(error.message).toBe('Test error');
            expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
            expect(error.name).toBe('BedrockAgentError');
            expect(error.timestamp).toBeInstanceOf(Date);
        });

        it('should include cause if provided', () => {
            const cause = new Error('Original error');
            const error = new BedrockAgentError('Test error', ErrorCode.UNKNOWN_ERROR, cause);

            expect(error.cause).toBe(cause);
        });

        it('should include context if provided', () => {
            const context = { userId: '123', action: 'test' };
            const error = new BedrockAgentError(
                'Test error',
                ErrorCode.UNKNOWN_ERROR,
                undefined,
                context,
            );

            expect(error.context).toEqual(context);
        });

        it('should serialize to JSON correctly', () => {
            const error = new BedrockAgentError('Test error', ErrorCode.UNKNOWN_ERROR);
            const json = error.toJSON();

            expect(json.name).toBe('BedrockAgentError');
            expect(json.message).toBe('Test error');
            expect(json.code).toBe(ErrorCode.UNKNOWN_ERROR);
            expect(json.timestamp).toBeDefined();
        });
    });

    describe('ValidationError', () => {
        it('should create validation error', () => {
            const error = new ValidationError('Invalid input');

            expect(error.message).toBe('Invalid input');
            expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            expect(error.name).toBe('ValidationError');
        });

        it('should include validation context', () => {
            const context = { field: 'email', value: 'invalid' };
            const error = new ValidationError('Invalid email', context);

            expect(error.context).toEqual(context);
        });
    });

    describe('APIError', () => {
        it('should create API error with status code', () => {
            const error = new APIError('API failed', 500);

            expect(error.message).toBe('API failed');
            expect(error.statusCode).toBe(500);
            expect(error.name).toBe('APIError');
        });

        it('should mark 429 as retryable', () => {
            const error = new APIError('Rate limited', 429);

            expect(error.retryable).toBe(true);
        });

        it('should mark 500 as retryable', () => {
            const error = new APIError('Server error', 503);

            expect(error.retryable).toBe(true);
        });

        it('should mark 400 as not retryable', () => {
            const error = new APIError('Bad request', 400);

            expect(error.retryable).toBe(false);
        });

        it('should set correct error code for 401', () => {
            const error = new APIError('Unauthorized', 401);

            expect(error.code).toBe(ErrorCode.API_UNAUTHORIZED);
        });

        it('should set correct error code for 404', () => {
            const error = new APIError('Not found', 404);

            expect(error.code).toBe(ErrorCode.API_NOT_FOUND);
        });
    });

    describe('ToolExecutionError', () => {
        it('should create tool execution error', () => {
            const error = new ToolExecutionError('my_tool', 'Tool failed');

            expect(error.message).toContain('my_tool');
            expect(error.message).toContain('Tool failed');
            expect(error.toolName).toBe('my_tool');
            expect(error.name).toBe('ToolExecutionError');
        });

        it('should include tool context', () => {
            const context = { input: { value: 123 } };
            const error = new ToolExecutionError('my_tool', 'Tool failed', undefined, context);

            expect(error.context).toMatchObject(context);
            expect(error.context?.toolName).toBe('my_tool');
        });
    });

    describe('MemoryError', () => {
        it('should create memory error', () => {
            const error = new MemoryError('Memory operation failed');

            expect(error.message).toBe('Memory operation failed');
            expect(error.code).toBe(ErrorCode.MEMORY_ERROR);
            expect(error.name).toBe('MemoryError');
        });
    });
});
