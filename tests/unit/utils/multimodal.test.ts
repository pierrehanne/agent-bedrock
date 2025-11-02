import { describe, it, expect } from 'vitest';
import {
    createImageFromS3,
    createImageFromBytes,
    createDocumentFromS3,
    createVideoFromS3,
} from '../../../src/utils/multimodal.js';

describe('Multimodal Utilities', () => {
    describe('createImageFromS3', () => {
        it('should create image content from S3 URI', () => {
            const image = createImageFromS3({
                format: 'jpeg',
                uri: 's3://my-bucket/image.jpg',
            });

            expect(image.image).toBeDefined();
            expect(image.image?.format).toBe('jpeg');
            expect(image.image?.source?.s3Location?.uri).toBe('s3://my-bucket/image.jpg');
        });

        it('should support different image formats', () => {
            const formats = ['png', 'jpeg', 'gif', 'webp'] as const;

            formats.forEach((format) => {
                const image = createImageFromS3({
                    format,
                    uri: `s3://bucket/image.${format}`,
                });

                expect(image.image?.format).toBe(format);
            });
        });

        it('should include bucket owner if provided', () => {
            const image = createImageFromS3({
                format: 'jpeg',
                uri: 's3://my-bucket/image.jpg',
                bucketOwner: '123456789012', // Valid 12-digit AWS account ID
            });

            expect(image.image?.source?.s3Location?.bucketOwner).toBe('123456789012');
        });
    });

    describe('createImageFromBytes', () => {
        it('should create image content from bytes', () => {
            const bytes = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG header

            const image = createImageFromBytes({
                format: 'jpeg',
                bytes,
            });

            expect(image.image).toBeDefined();
            expect(image.image?.format).toBe('jpeg');
            expect(image.image?.source?.bytes).toBe(bytes);
        });
    });

    describe('createDocumentFromS3', () => {
        it('should create document content from S3 URI', () => {
            const doc = createDocumentFromS3({
                format: 'pdf',
                uri: 's3://my-bucket/document.pdf',
                name: 'Test Document',
            });

            expect(doc.document).toBeDefined();
            expect(doc.document?.format).toBe('pdf');
            expect(doc.document?.source?.s3Location?.uri).toBe('s3://my-bucket/document.pdf');
        });

        it('should support different document formats', () => {
            const formats = ['pdf', 'csv', 'docx', 'txt'] as const;

            formats.forEach((format) => {
                const doc = createDocumentFromS3({
                    format,
                    uri: `s3://bucket/doc.${format}`,
                    name: `Test ${format}`,
                });

                expect(doc.document?.format).toBe(format);
            });
        });

        it('should require document name', () => {
            const doc = createDocumentFromS3({
                format: 'pdf',
                uri: 's3://my-bucket/document.pdf',
                name: 'My Document',
            });

            expect(doc.document?.name).toBe('My Document');
        });
    });

    describe('createVideoFromS3', () => {
        it('should create video content from S3 URI', () => {
            const video = createVideoFromS3({
                format: 'mp4',
                uri: 's3://my-bucket/video.mp4',
            });

            expect(video.video).toBeDefined();
            expect(video.video?.format).toBe('mp4');
            expect(video.video?.source?.s3Location?.uri).toBe('s3://my-bucket/video.mp4');
        });

        it('should support different video formats', () => {
            const formats = ['mp4', 'mov', 'webm'] as const;

            formats.forEach((format) => {
                const video = createVideoFromS3({
                    format,
                    uri: `s3://bucket/video.${format}`,
                });

                expect(video.video?.format).toBe(format);
            });
        });
    });
});
