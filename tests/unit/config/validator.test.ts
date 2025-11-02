import { describe, it, expect } from 'vitest';
import { InputValidator } from '../../../src/config/validator.js';
import type { AgentConfig } from '../../../src/config/types.js';

describe('Config Validator', () => {
    describe('validateAgentConfig', () => {
        it('should accept valid minimal config', () => {
            const config: AgentConfig = {
                name: 'test-agent',
                modelId: 'eu.amazon.nova-micro-v1:0',
            };

            expect(() => InputValidator.validateAgentConfig(config)).not.toThrow();
        });

        it('should reject empty name', () => {
            const config: AgentConfig = {
                name: '',
                modelId: 'eu.amazon.nova-micro-v1:0',
            };

            expect(() => InputValidator.validateAgentConfig(config)).toThrow();
        });

        it('should reject empty modelId', () => {
            const config: AgentConfig = {
                name: 'test-agent',
                modelId: '',
            };

            expect(() => InputValidator.validateAgentConfig(config)).toThrow();
        });

        it('should accept valid model config', () => {
            const config: AgentConfig = {
                name: 'test-agent',
                modelId: 'eu.amazon.nova-micro-v1:0',
                modelConfig: {
                    temperature: 0.7,
                    maxTokens: 2048,
                    topP: 0.9,
                },
            };

            expect(() => InputValidator.validateAgentConfig(config)).not.toThrow();
        });

        it('should reject invalid temperature', () => {
            const config: AgentConfig = {
                name: 'test-agent',
                modelId: 'eu.amazon.nova-micro-v1:0',
                modelConfig: {
                    temperature: 1.5, // Invalid: > 1
                },
            };

            expect(() => InputValidator.validateAgentConfig(config)).toThrow();
        });
    });
});
