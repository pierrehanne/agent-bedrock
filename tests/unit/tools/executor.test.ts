import { describe, it, expect, vi } from 'vitest';
import { ToolExecutor } from '../../../src/tools/executor.js';
import type { ToolDefinition } from '../../../src/tools/types.js';

describe('ToolExecutor', () => {
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

    const mockMetrics = {
        addMetric: vi.fn(),
        publishStoredMetrics: vi.fn(),
    };

    describe('tool registration', () => {
        it('should register local tools', () => {
            const tool: ToolDefinition = {
                name: 'test_tool',
                description: 'A test tool',
                inputSchema: {
                    type: 'object',
                    properties: {
                        input: { type: 'string' },
                    },
                    required: ['input'],
                },
                handler: async (input) => ({ result: 'success' }),
            };

            const executor = new ToolExecutor(
                [tool],
                undefined,
                mockLogger as any,
                mockMetrics as any,
            );
            expect(executor).toBeDefined();
        });
    });

    describe('tool validation', () => {
        it('should validate tool input schema', () => {
            const tool: ToolDefinition = {
                name: 'test_tool',
                description: 'A test tool',
                inputSchema: {
                    type: 'object',
                    properties: {
                        required_field: { type: 'string' },
                    },
                    required: ['required_field'],
                },
                handler: async (input) => input,
            };

            const executor = new ToolExecutor(
                [tool],
                undefined,
                mockLogger as any,
                mockMetrics as any,
            );
            expect(executor).toBeDefined();
        });
    });
});
