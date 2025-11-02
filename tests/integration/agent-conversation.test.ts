import { describe, it, expect } from 'vitest';
import { Agent } from '../../src/agent.js';
import { MODELS } from '../../src/constants/index.js';

describe('Agent Integration - Conversation Flow', () => {
    it.skip('should handle basic conversation', async () => {
        // Skip by default - requires AWS credentials
        const agent = new Agent({
            name: 'test-agent',
            modelId: MODELS.NOVA_MICRO,
        });

        const response = await agent.converse({
            message: 'Hello, how are you?',
        });

        expect(response).toBeDefined();
        expect(response.message).toBeDefined();
    });

    it.skip('should maintain conversation context', async () => {
        // Skip by default - requires AWS credentials
        const agent = new Agent({
            name: 'test-agent',
            modelId: MODELS.NOVA_MICRO,
            memory: {
                shortTerm: {
                    maxMessages: 10,
                    maxTokens: 2000,
                },
            },
        });

        const sessionId = 'test-session-1';

        await agent.converse({
            message: 'My name is Alice',
            sessionId,
        });

        const response = await agent.converse({
            message: 'What is my name?',
            sessionId,
        });

        expect(response.message).toContain('Alice');
    });
});
