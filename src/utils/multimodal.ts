import type {
    ImageContent,
    DocumentContent,
    VideoContent,
    S3Location,
} from '../config/message-types.js';
import { ValidationError } from '../errors/index.js';

export interface ImageFromBytesOptions {
    format: 'png' | 'jpeg' | 'gif' | 'webp';
    bytes: Uint8Array;
}

export interface ImageFromS3Options {
    format: 'png' | 'jpeg' | 'gif' | 'webp';
    /** S3 URI in format s3://bucket-name/key */
    uri: string;
    /** AWS account ID of bucket owner. Required for cross-account access. */
    bucketOwner?: string;
}

export interface DocumentFromBytesOptions {
    format: 'pdf' | 'csv' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'html' | 'txt' | 'md';
    name: string;
    bytes: Uint8Array;
}

export interface DocumentFromS3Options {
    format: 'pdf' | 'csv' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'html' | 'txt' | 'md';
    name: string;
    /** S3 URI in format s3://bucket-name/key */
    uri: string;
    /** AWS account ID of bucket owner. Required for cross-account access. */
    bucketOwner?: string;
}

export interface VideoFromBytesOptions {
    format: 'mp4' | 'mov' | 'avi' | 'flv' | 'mkv' | 'webm';
    bytes: Uint8Array;
}

export interface VideoFromS3Options {
    format: 'mp4' | 'mov' | 'avi' | 'flv' | 'mkv' | 'webm';
    /** S3 URI in format s3://bucket-name/key */
    uri: string;
    /** AWS account ID of bucket owner. Required for cross-account access. */
    bucketOwner?: string;
}

export function createImageFromBytes(options: ImageFromBytesOptions): ImageContent {
    // Validate format
    const validFormats = ['png', 'jpeg', 'gif', 'webp'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(`Image format must be one of: ${validFormats.join(', ')}`, {
            field: 'format',
            value: options.format,
        });
    }

    // Validate bytes
    if (!(options.bytes instanceof Uint8Array)) {
        throw new ValidationError('Image bytes must be a Uint8Array', {
            field: 'bytes',
            value: typeof options.bytes,
        });
    }

    if (options.bytes.length === 0) {
        throw new ValidationError('Image bytes cannot be empty', { field: 'bytes' });
    }

    return {
        image: {
            format: options.format,
            source: {
                bytes: options.bytes,
            },
        },
    };
}

export function createImageFromS3(options: ImageFromS3Options): ImageContent {
    // Validate format
    const validFormats = ['png', 'jpeg', 'gif', 'webp'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(`Image format must be one of: ${validFormats.join(', ')}`, {
            field: 'format',
            value: options.format,
        });
    }

    // Validate and create S3 location
    const s3Location = createS3Location(options.uri, options.bucketOwner);

    return {
        image: {
            format: options.format,
            source: {
                s3Location,
            },
        },
    };
}

export function createDocumentFromBytes(options: DocumentFromBytesOptions): DocumentContent {
    // Validate format
    const validFormats = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(`Document format must be one of: ${validFormats.join(', ')}`, {
            field: 'format',
            value: options.format,
        });
    }

    // Validate name
    if (!options.name || typeof options.name !== 'string') {
        throw new ValidationError('Document name is required and must be a non-empty string', {
            field: 'name',
            value: options.name,
        });
    }

    if (options.name.trim().length === 0) {
        throw new ValidationError('Document name cannot be empty or whitespace only', {
            field: 'name',
        });
    }

    // Validate bytes
    if (!(options.bytes instanceof Uint8Array)) {
        throw new ValidationError('Document bytes must be a Uint8Array', {
            field: 'bytes',
            value: typeof options.bytes,
        });
    }

    if (options.bytes.length === 0) {
        throw new ValidationError('Document bytes cannot be empty', { field: 'bytes' });
    }

    return {
        document: {
            format: options.format,
            name: options.name,
            source: {
                bytes: options.bytes,
            },
        },
    };
}

export function createDocumentFromS3(options: DocumentFromS3Options): DocumentContent {
    // Validate format
    const validFormats = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(`Document format must be one of: ${validFormats.join(', ')}`, {
            field: 'format',
            value: options.format,
        });
    }

    // Validate name
    if (!options.name || typeof options.name !== 'string') {
        throw new ValidationError('Document name is required and must be a non-empty string', {
            field: 'name',
            value: options.name,
        });
    }

    if (options.name.trim().length === 0) {
        throw new ValidationError('Document name cannot be empty or whitespace only', {
            field: 'name',
        });
    }

    // Validate and create S3 location
    const s3Location = createS3Location(options.uri, options.bucketOwner);

    return {
        document: {
            format: options.format,
            name: options.name,
            source: {
                s3Location,
            },
        },
    };
}

export function createVideoFromBytes(options: VideoFromBytesOptions): VideoContent {
    // Validate format
    const validFormats = ['mp4', 'mov', 'avi', 'flv', 'mkv', 'webm'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(`Video format must be one of: ${validFormats.join(', ')}`, {
            field: 'format',
            value: options.format,
        });
    }

    // Validate bytes
    if (!(options.bytes instanceof Uint8Array)) {
        throw new ValidationError('Video bytes must be a Uint8Array', {
            field: 'bytes',
            value: typeof options.bytes,
        });
    }

    if (options.bytes.length === 0) {
        throw new ValidationError('Video bytes cannot be empty', { field: 'bytes' });
    }

    return {
        video: {
            format: options.format,
            source: {
                bytes: options.bytes,
            },
        },
    };
}

export function createVideoFromS3(options: VideoFromS3Options): VideoContent {
    // Validate format
    const validFormats = ['mp4', 'mov', 'avi', 'flv', 'mkv', 'webm'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(`Video format must be one of: ${validFormats.join(', ')}`, {
            field: 'format',
            value: options.format,
        });
    }

    // Validate and create S3 location
    const s3Location = createS3Location(options.uri, options.bucketOwner);

    return {
        video: {
            format: options.format,
            source: {
                s3Location,
            },
        },
    };
}

function createS3Location(uri: string, bucketOwner?: string): S3Location {
    // Validate URI
    if (!uri || typeof uri !== 'string') {
        throw new ValidationError('S3 URI is required and must be a non-empty string', {
            field: 'uri',
            value: uri,
        });
    }

    if (!uri.startsWith('s3://')) {
        throw new ValidationError('S3 URI must start with "s3://"', { field: 'uri', value: uri });
    }

    if (uri.length <= 5) {
        throw new ValidationError('S3 URI must include bucket and key', {
            field: 'uri',
            value: uri,
        });
    }

    // Validate bucket owner if provided
    if (bucketOwner !== undefined) {
        if (typeof bucketOwner !== 'string') {
            throw new ValidationError('Bucket owner must be a string', {
                field: 'bucketOwner',
                value: typeof bucketOwner,
            });
        }

        if (bucketOwner.trim().length === 0) {
            throw new ValidationError('Bucket owner cannot be empty or whitespace only', {
                field: 'bucketOwner',
            });
        }

        // Validate AWS account ID format (12 digits)
        if (!/^\d{12}$/.test(bucketOwner)) {
            throw new ValidationError('Bucket owner must be a 12-digit AWS account ID', {
                field: 'bucketOwner',
                value: bucketOwner,
            });
        }
    }

    const location: S3Location = { uri };

    if (bucketOwner) {
        location.bucketOwner = bucketOwner;
    }

    return location;
}
