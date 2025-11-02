import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryManager } from '../../../src/memory/manager.js';
import type { Message } from '../../../src/config/message-types.js';

describe('MemoryManager', () => {
    let memoryManager: MemoryManager;

    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

    beforeEach(() => {
        memoryManager = new MemoryManager(
            {
                shortTerm: {
                    maxMessages: 5,
                    maxTokens: 1000,
                },
            },
            mockLogger as any,
        );
    });

    describe('message storage', () => {
        it('should add messages to memory', () => {
            const message: Message = {
                role: 'user',
                content: [{ text: 'Hello' }],
            };

            memoryManager.addMessage(message);
            const history = memoryManager.getMessages();

            expect(history).toHaveLength(1);
            expect(history[0]).toEqual(message);
        });

        it('should retrieve conversation history', () => {
            const message1: Message = {
                role: 'user',
                content: [{ text: 'Hello' }],
            };
            const message2: Message = {
                role: 'assistant',
                content: [{ text: 'Hi there!' }],
            };

            memoryManager.addMessage(message1);
            memoryManager.addMessage(message2);

            const history = memoryManager.getMessages();
            expect(history).toHaveLength(2);
            expect(history[0]).toEqual(message1);
            expect(history[1]).toEqual(message2);
        });
    });

    describe('pruning', () => {
        it('should prune old messages when limit exceeded', () => {
            // Add more messages than the limit
            for (let i = 0; i < 10; i++) {
                memoryManager.addMessage({
                    role: 'user',
                    content: [{ text: `Message ${i}` }],
                });
            }

            const history = memoryManager.getMessages();
            expect(history.length).toBeLessThanOrEqual(5);
        });
    });
});
