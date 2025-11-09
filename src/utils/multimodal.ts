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
    return {
        image: {
            format: options.format,
            source: { bytes: options.bytes },
        },
    };
}

export function createImageFromS3(options: ImageFromS3Options): ImageContent {
    return {
        image: {
            format: options.format,
            source: { s3Location: { uri: options.uri, ...(options.bucketOwner && { bucketOwner: options.bucketOwner }) } },
        },
    };
}

export function createDocumentFromBytes(options: DocumentFromBytesOptions): DocumentContent {
    return {
        document: {
            format: options.format,
            name: options.name,
            source: { bytes: options.bytes },
        },
    };
}

export function createDocumentFromS3(options: DocumentFromS3Options): DocumentContent {
    return {
        document: {
            format: options.format,
            name: options.name,
            source: { s3Location: { uri: options.uri, ...(options.bucketOwner && { bucketOwner: options.bucketOwner }) } },
        },
    };
}

export function createVideoFromBytes(options: VideoFromBytesOptions): VideoContent {
    return {
        video: {
            format: options.format,
            source: { bytes: options.bytes },
        },
    };
}

export function createVideoFromS3(options: VideoFromS3Options): VideoContent {
    return {
        video: {
            format: options.format,
            source: { s3Location: { uri: options.uri, ...(options.bucketOwner && { bucketOwner: options.bucketOwner }) } },
        },
    };
}
