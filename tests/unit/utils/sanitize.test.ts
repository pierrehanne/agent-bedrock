import { describe, it, expect } from 'vitest';
import { sanitizeString } from '../../../src/utils/sanitize.js';

describe('sanitizeString', () => {
    describe('email redaction', () => {
        it('should redact email addresses', () => {
            const input = 'Contact me at user@example.com';
            const result = sanitizeString(input);

            expect(result).not.toContain('user@example.com');
            expect(result).toContain('[REDACTED]');
        });
    });

    describe('phone redaction', () => {
        it('should redact phone numbers', () => {
            const input = 'Call me at 555-123-4567';
            const result = sanitizeString(input);

            expect(result).not.toContain('555-123-4567');
            expect(result).toContain('[REDACTED]');
        });
    });

    describe('AWS credentials redaction', () => {
        it('should redact AWS access keys', () => {
            const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
            const result = sanitizeString(input);

            expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
            expect(result).toContain('[REDACTED]');
        });
    });

    describe('custom patterns', () => {
        it('should support custom redaction patterns', () => {
            const input = 'Secret code: ABC123';
            const result = sanitizeString(input, {
                customPatterns: [/ABC\d+/g],
            });

            expect(result).not.toContain('ABC123');
            expect(result).toContain('[REDACTED]');
        });
    });
});
