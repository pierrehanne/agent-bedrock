const PII_PATTERNS = {
    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Phone numbers (various formats)
    phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

    // Credit card numbers (basic pattern)
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

    // Social Security Numbers (US format)
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

    // IP addresses
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // AWS Access Key IDs
    awsAccessKey: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,

    // AWS Secret Access Keys (basic pattern)
    awsSecretKey: /\b[A-Za-z0-9/+=]{40}\b/g,
};

const SENSITIVE_FIELDS = new Set([
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'accessKey',
    'access_key',
    'secretKey',
    'secret_key',
    'privateKey',
    'private_key',
    'authorization',
    'auth',
    'credentials',
    'creditCard',
    'credit_card',
    'ssn',
    'socialSecurity',
    'social_security',
]);

export interface SanitizeConfig {
    /** Disable all built-in patterns. @default false */
    disableDefaults?: boolean;
    customPatterns?: RegExp[];
    customSensitiveFields?: string[];
    /** @default '[REDACTED]' */
    replacementText?: string;
}

export function sanitizeString(text: string, config: SanitizeConfig = {}): string {
    const { disableDefaults = false, customPatterns = [], replacementText = '[REDACTED]' } = config;

    let sanitized = text;

    // Apply all built-in patterns by default
    if (!disableDefaults) {
        sanitized = sanitized
            .replace(PII_PATTERNS.email, replacementText)
            .replace(PII_PATTERNS.phone, replacementText)
            .replace(PII_PATTERNS.creditCard, replacementText)
            .replace(PII_PATTERNS.ssn, replacementText)
            .replace(PII_PATTERNS.awsAccessKey, replacementText)
            .replace(PII_PATTERNS.awsSecretKey, replacementText);
    }

    // Apply custom patterns
    for (const pattern of customPatterns) {
        sanitized = sanitized.replace(pattern, replacementText);
    }

    return sanitized;
}

/** Recursively sanitizes objects and arrays, removing PII and sensitive data. */
export function sanitizeObject(obj: any, config: SanitizeConfig = {}): any {
    const { customSensitiveFields = [], replacementText = '[REDACTED]' } = config;

    // Combine default and custom sensitive fields
    const allSensitiveFields = new Set([...SENSITIVE_FIELDS, ...customSensitiveFields]);

    function sanitizeValue(value: any, key?: string): any {
        // Check if the key is sensitive
        if (key && isSensitiveField(key, allSensitiveFields)) {
            return replacementText;
        }

        // Handle different types
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === 'string') {
            return sanitizeString(value, config);
        }

        if (Array.isArray(value)) {
            return value.map((item) => sanitizeValue(item));
        }

        if (typeof value === 'object') {
            const sanitized: any = {};
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                sanitized[k] = sanitizeValue(v, k);
            }
            return sanitized;
        }

        return value;
    }

    return sanitizeValue(obj);
}

function isSensitiveField(fieldName: string, sensitiveFields: Set<string>): boolean {
    const lowerFieldName = fieldName.toLowerCase();

    // Check exact match
    if (sensitiveFields.has(lowerFieldName)) {
        return true;
    }

    // Check if field name contains any sensitive keyword
    for (const sensitive of sensitiveFields) {
        if (lowerFieldName.includes(sensitive.toLowerCase())) {
            return true;
        }
    }

    return false;
}

// Removed: Use sanitizeString/sanitizeObject directly
