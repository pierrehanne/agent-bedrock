/**
 * Log sanitization utilities
 * 
 * This module provides utilities for sanitizing log data to remove
 * Personally Identifiable Information (PII) and sensitive data.
 */

/**
 * Patterns for detecting common PII types.
 */
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

/**
 * Sensitive field names that should be redacted.
 */
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

/**
 * Configuration options for sanitization.
 */
export interface SanitizeConfig {
    /**
     * Whether to redact email addresses.
     * 
     * @default true
     */
    redactEmails?: boolean;

    /**
     * Whether to redact phone numbers.
     * 
     * @default true
     */
    redactPhones?: boolean;

    /**
     * Whether to redact credit card numbers.
     * 
     * @default true
     */
    redactCreditCards?: boolean;

    /**
     * Whether to redact SSNs.
     * 
     * @default true
     */
    redactSSNs?: boolean;

    /**
     * Whether to redact IP addresses.
     * 
     * @default false
     */
    redactIPs?: boolean;

    /**
     * Whether to redact AWS credentials.
     * 
     * @default true
     */
    redactAWSCredentials?: boolean;

    /**
     * Custom patterns to redact.
     */
    customPatterns?: RegExp[];

    /**
     * Custom field names to redact.
     */
    customSensitiveFields?: string[];

    /**
     * Replacement text for redacted values.
     * 
     * @default '[REDACTED]'
     */
    replacementText?: string;
}

/**
 * Sanitizes a string by removing PII and sensitive data.
 * 
 * @param text - Text to sanitize
 * @param config - Sanitization configuration
 * @returns Sanitized text
 * 
 * @example
 * ```typescript
 * const sanitized = sanitizeString(
 *   'Contact me at john@example.com or 555-123-4567',
 *   { redactEmails: true, redactPhones: true }
 * );
 * // Result: 'Contact me at [REDACTED] or [REDACTED]'
 * ```
 */
export function sanitizeString(
    text: string,
    config: SanitizeConfig = {}
): string {
    const {
        redactEmails = true,
        redactPhones = true,
        redactCreditCards = true,
        redactSSNs = true,
        redactIPs = false,
        redactAWSCredentials = true,
        customPatterns = [],
        replacementText = '[REDACTED]',
    } = config;

    let sanitized = text;

    // Apply built-in patterns
    if (redactEmails) {
        sanitized = sanitized.replace(PII_PATTERNS.email, replacementText);
    }
    if (redactPhones) {
        sanitized = sanitized.replace(PII_PATTERNS.phone, replacementText);
    }
    if (redactCreditCards) {
        sanitized = sanitized.replace(PII_PATTERNS.creditCard, replacementText);
    }
    if (redactSSNs) {
        sanitized = sanitized.replace(PII_PATTERNS.ssn, replacementText);
    }
    if (redactIPs) {
        sanitized = sanitized.replace(PII_PATTERNS.ipAddress, replacementText);
    }
    if (redactAWSCredentials) {
        sanitized = sanitized.replace(PII_PATTERNS.awsAccessKey, replacementText);
        sanitized = sanitized.replace(PII_PATTERNS.awsSecretKey, replacementText);
    }

    // Apply custom patterns
    for (const pattern of customPatterns) {
        sanitized = sanitized.replace(pattern, replacementText);
    }

    return sanitized;
}

/**
 * Sanitizes an object by removing PII and sensitive data.
 * Recursively processes nested objects and arrays.
 * 
 * @param obj - Object to sanitize
 * @param config - Sanitization configuration
 * @returns Sanitized object
 * 
 * @example
 * ```typescript
 * const sanitized = sanitizeObject({
 *   user: {
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     password: 'secret123'
 *   }
 * });
 * // Result: { user: { name: 'John Doe', email: '[REDACTED]', password: '[REDACTED]' } }
 * ```
 */
export function sanitizeObject(
    obj: any,
    config: SanitizeConfig = {}
): any {
    const {
        customSensitiveFields = [],
        replacementText = '[REDACTED]',
    } = config;

    // Combine default and custom sensitive fields
    const allSensitiveFields = new Set([
        ...SENSITIVE_FIELDS,
        ...customSensitiveFields,
    ]);

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

/**
 * Checks if a field name is sensitive.
 * 
 * @param fieldName - Field name to check
 * @param sensitiveFields - Set of sensitive field names
 * @returns True if the field is sensitive
 */
function isSensitiveField(
    fieldName: string,
    sensitiveFields: Set<string>
): boolean {
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

/**
 * Sanitizes log data before logging.
 * Handles both string and object inputs.
 * 
 * @param data - Data to sanitize
 * @param config - Sanitization configuration
 * @returns Sanitized data
 * 
 * @example
 * ```typescript
 * logger.info('User data', sanitizeLogData({
 *   email: 'user@example.com',
 *   message: 'Hello world'
 * }));
 * ```
 */
export function sanitizeLogData(
    data: any,
    config: SanitizeConfig = {}
): any {
    if (typeof data === 'string') {
        return sanitizeString(data, config);
    }

    if (typeof data === 'object' && data !== null) {
        return sanitizeObject(data, config);
    }

    return data;
}

/**
 * Creates a sanitization function with pre-configured options.
 * Useful for creating a consistent sanitizer across the application.
 * 
 * @param config - Sanitization configuration
 * @returns Sanitization function
 * 
 * @example
 * ```typescript
 * const sanitize = createSanitizer({
 *   redactEmails: true,
 *   redactPhones: true,
 *   customSensitiveFields: ['userId', 'accountId']
 * });
 * 
 * logger.info('Data', sanitize(userData));
 * ```
 */
export function createSanitizer(
    config: SanitizeConfig = {}
): (data: any) => any {
    return (data: any) => sanitizeLogData(data, config);
}
