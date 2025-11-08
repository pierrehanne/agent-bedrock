/**
 * Application-wide constants.
 */

/**
 * Default configuration values.
 */
export const DEFAULTS = {
    MODEL: {
        TEMPERATURE: 0.7,
        MAX_TOKENS: 2048,
        TOP_P: 0.9,
    },
    MEMORY: {
        SHORT_TERM_MAX_MESSAGES: 20,
        SHORT_TERM_MAX_TOKENS: 4000,
    },
    MCP: {
        RECONNECT_ENABLED: true,
        RECONNECT_MAX_ATTEMPTS: 3,
        RECONNECT_DELAY_MS: 1000,
    },
    RETRY: {
        MAX_ATTEMPTS: 3,
        BASE_DELAY_MS: 1000,
        MAX_DELAY_MS: 30000,
    },
} as const;

/**
 * AWS Bedrock model identifiers.
 */
export const MODELS = {
    NOVA_MICRO: 'eu.amazon.nova-micro-v1:0',
    NOVA_LITE: 'eu.amazon.nova-lite-v1:0',
    NOVA_PRO: 'eu.amazon.nova-pro-v1:0',
} as const;

/**
 * Supported content formats.
 */
export const FORMATS = {
    IMAGE: ['png', 'jpeg', 'gif', 'webp'] as const,
    DOCUMENT: ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'] as const,
    VIDEO: ['mp4', 'mov', 'avi', 'flv', 'mkv', 'webm'] as const,
} as const;

/**
 * HTTP status codes.
 */
export const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
} as const;
