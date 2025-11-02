import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../../src/agent.js';

describe('Agent', () => {
    describe('constructor', () => {
        it('should create agent with minimal config', () => {
            const agent = new Agent({
                name: 'test-agent',
                modelId: 'eu.amazon.nova-micro-v1:0',
            });

            expect(agent).toBeDefined();
        });

        it('should throw error with invalid config', () => {
            expect(() => {
                new Agent({
                    name: '',
                    modelId: 'eu.amazon.nova-micro-v1:0',
                });
            }).toThrow();
        });
    });

    describe('configuration', () => {
        it('should accept custom model config', () => {
            const agent = new Agent({
                name: 'test-agent',
                modelId: 'eu.amazon.nova-micro-v1:0',
                modelConfig: {
                    temperature: 0.5,
                    maxTokens: 1000,
                },
            });

            expect(agent).toBeDefined();
        });

        it('should accept memory config', () => {
            const agent = new Agent({
                name: 'test-agent',
                modelId: 'eu.amazon.nova-micro-v1:0',
                memory: {
                    shortTerm: {
                        maxMessages: 10,
                        maxTokens: 2000,
                    },
                },
            });

            expect(agent).toBeDefined();
        });
    });
});
