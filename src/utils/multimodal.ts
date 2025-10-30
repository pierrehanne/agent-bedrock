/**
 * Multimodal content helper utilities.
 * 
 * This module provides helper functions for creating multimodal content blocks
 * including images, documents, and videos from various sources.
 */

import type {
    ImageContent,
    DocumentContent,
    VideoContent,
    S3Location,
} from '../config/message-types.js';
import { ValidationError } from '../errors/index.js';

/**
 * Options for creating image content from bytes.
 */
export interface ImageFromBytesOptions {
    /**
     * Image format.
     */
    format: 'png' | 'jpeg' | 'gif' | 'webp';

    /**
     * Raw image bytes.
     */
    bytes: Uint8Array;
}

/**
 * Options for creating image content from S3.
 */
export interface ImageFromS3Options {
    /**
     * Image format.
     */
    format: 'png' | 'jpeg' | 'gif' | 'webp';

    /**
     * S3 URI in format s3://bucket-name/key.
     */
    uri: string;

    /**
     * Optional AWS account ID of the bucket owner.
     * Required for cross-account access.
     */
    bucketOwner?: string;
}

/**
 * Options for creating document content from bytes.
 */
export interface DocumentFromBytesOptions {
    /**
     * Document format.
     */
    format: 'pdf' | 'csv' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'html' | 'txt' | 'md';

    /**
     * Document name for reference.
     */
    name: string;

    /**
     * Raw document bytes.
     */
    bytes: Uint8Array;
}

/**
 * Options for creating document content from S3.
 */
export interface DocumentFromS3Options {
    /**
     * Document format.
     */
    format: 'pdf' | 'csv' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'html' | 'txt' | 'md';

    /**
     * Document name for reference.
     */
    name: string;

    /**
     * S3 URI in format s3://bucket-name/key.
     */
    uri: string;

    /**
     * Optional AWS account ID of the bucket owner.
     * Required for cross-account access.
     */
    bucketOwner?: string;
}

/**
 * Options for creating video content from bytes.
 */
export interface VideoFromBytesOptions {
    /**
     * Video format.
     */
    format: 'mp4' | 'mov' | 'avi' | 'flv' | 'mkv' | 'webm';

    /**
     * Raw video bytes.
     */
    bytes: Uint8Array;
}

/**
 * Options for creating video content from S3.
 */
export interface VideoFromS3Options {
    /**
     * Video format.
     */
    format: 'mp4' | 'mov' | 'avi' | 'flv' | 'mkv' | 'webm';

    /**
     * S3 URI in format s3://bucket-name/key.
     */
    uri: string;

    /**
     * Optional AWS account ID of the bucket owner.
     * Required for cross-account access.
     */
    bucketOwner?: string;
}

/**
 * Creates an ImageContent block from raw bytes.
 * 
 * @param options - Image creation options
 * @returns ImageContent block
 * @throws {ValidationError} If options are invalid
 * 
 * @example
 * ```typescript
 * const imageContent = createImageFromBytes({
 *   format: 'png',
 *   bytes: imageBuffer
 * });
 * ```
 */
export function createImageFromBytes(options: ImageFromBytesOptions): ImageContent {
    // Validate format
    const validFormats = ['png', 'jpeg', 'gif', 'webp'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(
            `Image format must be one of: ${validFormats.join(', ')}`,
            { field: 'format', value: options.format }
        );
    }

    // Validate bytes
    if (!(options.bytes instanceof Uint8Array)) {
        throw new ValidationError(
            'Image bytes must be a Uint8Array',
            { field: 'bytes', value: typeof options.bytes }
        );
    }

    if (options.bytes.length === 0) {
        throw new ValidationError(
            'Image bytes cannot be empty',
            { field: 'bytes' }
        );
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

/**
 * Creates an ImageContent block from an S3 URI.
 * 
 * @param options - Image creation options
 * @returns ImageContent block
 * @throws {ValidationError} If options are invalid
 * 
 * @example
 * ```typescript
 * const imageContent = createImageFromS3({
 *   format: 'jpeg',
 *   uri: 's3://my-bucket/images/photo.jpg'
 * });
 * 
 * // With cross-account access
 * const imageContent = createImageFromS3({
 *   format: 'png',
 *   uri: 's3://other-bucket/image.png',
 *   bucketOwner: '123456789012'
 * });
 * ```
 */
export function createImageFromS3(options: ImageFromS3Options): ImageContent {
    // Validate format
    const validFormats = ['png', 'jpeg', 'gif', 'webp'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(
            `Image format must be one of: ${validFormats.join(', ')}`,
            { field: 'format', value: options.format }
        );
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

/**
 * Creates a DocumentContent block from raw bytes.
 * 
 * @param options - Document creation options
 * @returns DocumentContent block
 * @throws {ValidationError} If options are invalid
 * 
 * @example
 * ```typescript
 * const docContent = createDocumentFromBytes({
 *   format: 'pdf',
 *   name: 'report.pdf',
 *   bytes: pdfBuffer
 * });
 * ```
 */
export function createDocumentFromBytes(options: DocumentFromBytesOptions): DocumentContent {
    // Validate format
    const validFormats = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(
            `Document format must be one of: ${validFormats.join(', ')}`,
            { field: 'format', value: options.format }
        );
    }

    // Validate name
    if (!options.name || typeof options.name !== 'string') {
        throw new ValidationError(
            'Document name is required and must be a non-empty string',
            { field: 'name', value: options.name }
        );
    }

    if (options.name.trim().length === 0) {
        throw new ValidationError(
            'Document name cannot be empty or whitespace only',
            { field: 'name' }
        );
    }

    // Validate bytes
    if (!(options.bytes instanceof Uint8Array)) {
        throw new ValidationError(
            'Document bytes must be a Uint8Array',
            { field: 'bytes', value: typeof options.bytes }
        );
    }

    if (options.bytes.length === 0) {
        throw new ValidationError(
            'Document bytes cannot be empty',
            { field: 'bytes' }
        );
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

/**
 * Creates a DocumentContent block from an S3 URI.
 * 
 * @param options - Document creation options
 * @returns DocumentContent block
 * @throws {ValidationError} If options are invalid
 * 
 * @example
 * ```typescript
 * const docContent = createDocumentFromS3({
 *   format: 'pdf',
 *   name: 'report.pdf',
 *   uri: 's3://my-bucket/documents/report.pdf'
 * });
 * 
 * // With cross-account access
 * const docContent = createDocumentFromS3({
 *   format: 'xlsx',
 *   name: 'data.xlsx',
 *   uri: 's3://other-bucket/data.xlsx',
 *   bucketOwner: '123456789012'
 * });
 * ```
 */
export function createDocumentFromS3(options: DocumentFromS3Options): DocumentContent {
    // Validate format
    const validFormats = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(
            `Document format must be one of: ${validFormats.join(', ')}`,
            { field: 'format', value: options.format }
        );
    }

    // Validate name
    if (!options.name || typeof options.name !== 'string') {
        throw new ValidationError(
            'Document name is required and must be a non-empty string',
            { field: 'name', value: options.name }
        );
    }

    if (options.name.trim().length === 0) {
        throw new ValidationError(
            'Document name cannot be empty or whitespace only',
            { field: 'name' }
        );
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

/**
 * Creates a VideoContent block from raw bytes.
 * 
 * @param options - Video creation options
 * @returns VideoContent block
 * @throws {ValidationError} If options are invalid
 * 
 * @example
 * ```typescript
 * const videoContent = createVideoFromBytes({
 *   format: 'mp4',
 *   bytes: videoBuffer
 * });
 * ```
 */
export function createVideoFromBytes(options: VideoFromBytesOptions): VideoContent {
    // Validate format
    const validFormats = ['mp4', 'mov', 'avi', 'flv', 'mkv', 'webm'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(
            `Video format must be one of: ${validFormats.join(', ')}`,
            { field: 'format', value: options.format }
        );
    }

    // Validate bytes
    if (!(options.bytes instanceof Uint8Array)) {
        throw new ValidationError(
            'Video bytes must be a Uint8Array',
            { field: 'bytes', value: typeof options.bytes }
        );
    }

    if (options.bytes.length === 0) {
        throw new ValidationError(
            'Video bytes cannot be empty',
            { field: 'bytes' }
        );
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

/**
 * Creates a VideoContent block from an S3 URI.
 * 
 * @param options - Video creation options
 * @returns VideoContent block
 * @throws {ValidationError} If options are invalid
 * 
 * @example
 * ```typescript
 * const videoContent = createVideoFromS3({
 *   format: 'mp4',
 *   uri: 's3://my-bucket/videos/demo.mp4'
 * });
 * 
 * // With cross-account access
 * const videoContent = createVideoFromS3({
 *   format: 'webm',
 *   uri: 's3://other-bucket/video.webm',
 *   bucketOwner: '123456789012'
 * });
 * ```
 */
export function createVideoFromS3(options: VideoFromS3Options): VideoContent {
    // Validate format
    const validFormats = ['mp4', 'mov', 'avi', 'flv', 'mkv', 'webm'];
    if (!validFormats.includes(options.format)) {
        throw new ValidationError(
            `Video format must be one of: ${validFormats.join(', ')}`,
            { field: 'format', value: options.format }
        );
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

/**
 * Creates and validates an S3Location object.
 * 
 * @param uri - S3 URI in format s3://bucket-name/key
 * @param bucketOwner - Optional AWS account ID of the bucket owner
 * @returns S3Location object
 * @throws {ValidationError} If URI is invalid
 * @private
 */
function createS3Location(uri: string, bucketOwner?: string): S3Location {
    // Validate URI
    if (!uri || typeof uri !== 'string') {
        throw new ValidationError(
            'S3 URI is required and must be a non-empty string',
            { field: 'uri', value: uri }
        );
    }

    if (!uri.startsWith('s3://')) {
        throw new ValidationError(
            'S3 URI must start with "s3://"',
            { field: 'uri', value: uri }
        );
    }

    if (uri.length <= 5) {
        throw new ValidationError(
            'S3 URI must include bucket and key',
            { field: 'uri', value: uri }
        );
    }

    // Validate bucket owner if provided
    if (bucketOwner !== undefined) {
        if (typeof bucketOwner !== 'string') {
            throw new ValidationError(
                'Bucket owner must be a string',
                { field: 'bucketOwner', value: typeof bucketOwner }
            );
        }

        if (bucketOwner.trim().length === 0) {
            throw new ValidationError(
                'Bucket owner cannot be empty or whitespace only',
                { field: 'bucketOwner' }
            );
        }

        // Validate AWS account ID format (12 digits)
        if (!/^\d{12}$/.test(bucketOwner)) {
            throw new ValidationError(
                'Bucket owner must be a 12-digit AWS account ID',
                { field: 'bucketOwner', value: bucketOwner }
            );
        }
    }

    const location: S3Location = { uri };

    if (bucketOwner) {
        location.bucketOwner = bucketOwner;
    }

    return location;
}
