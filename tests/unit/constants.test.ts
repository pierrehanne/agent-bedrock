import { describe, it, expect } from 'vitest';
import { MODELS, DEFAULTS, FORMATS, HTTP_STATUS } from '../../src/constants/index.js';

describe('Constants', () => {
    describe('MODELS', () => {
        it('should have Nova model identifiers', () => {
            expect(MODELS.NOVA_MICRO).toBe('eu.amazon.nova-micro-v1:0');
            expect(MODELS.NOVA_LITE).toBeDefined();
            expect(MODELS.NOVA_PRO).toBeDefined();
        });

        it('should have Claude model identifiers', () => {
            expect(MODELS.CLAUDE_3_SONNET).toBeDefined();
            expect(MODELS.CLAUDE_3_HAIKU).toBeDefined();
        });
    });

    describe('DEFAULTS', () => {
        it('should have model defaults', () => {
            expect(DEFAULTS.MODEL.TEMPERATURE).toBe(0.7);
            expect(DEFAULTS.MODEL.MAX_TOKENS).toBe(2048);
            expect(DEFAULTS.MODEL.TOP_P).toBe(0.9);
        });

        it('should have memory defaults', () => {
            expect(DEFAULTS.MEMORY.SHORT_TERM_MAX_MESSAGES).toBe(20);
            expect(DEFAULTS.MEMORY.SHORT_TERM_MAX_TOKENS).toBe(4000);
        });

        it('should have MCP defaults', () => {
            expect(DEFAULTS.MCP.RECONNECT_ENABLED).toBe(true);
            expect(DEFAULTS.MCP.RECONNECT_MAX_ATTEMPTS).toBe(3);
        });
    });

    describe('FORMATS', () => {
        it('should have image formats', () => {
            expect(FORMATS.IMAGE).toContain('png');
            expect(FORMATS.IMAGE).toContain('jpeg');
            expect(FORMATS.IMAGE).toContain('webp');
        });

        it('should have document formats', () => {
            expect(FORMATS.DOCUMENT).toContain('pdf');
            expect(FORMATS.DOCUMENT).toContain('docx');
        });

        it('should have video formats', () => {
            expect(FORMATS.VIDEO).toContain('mp4');
            expect(FORMATS.VIDEO).toContain('webm');
        });
    });

    describe('HTTP_STATUS', () => {
        it('should have common status codes', () => {
            expect(HTTP_STATUS.OK).toBe(200);
            expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
            expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
            expect(HTTP_STATUS.NOT_FOUND).toBe(404);
            expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
            expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
        });
    });
});
