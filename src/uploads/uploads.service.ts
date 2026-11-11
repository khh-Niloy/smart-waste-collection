import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_IMAGE_MIMES: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface UploadedPhotoResult {
  storageKey: string;
  previewUrl: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class UploadsService {
  constructor(private readonly storageService: SupabaseStorageService) {}

  async uploadReportPhoto(
    file: Express.Multer.File | undefined,
  ): Promise<UploadedPhotoResult> {
    if (!file) {
      throw new BadRequestException('Photograph file is required');
    }

    if (file.size <= 0 || file.size > MAX_PHOTO_SIZE_BYTES) {
      throw new BadRequestException(
        'Photograph must be larger than 0 bytes and at most 5 MB',
      );
    }

    const declaredMime = file.mimetype.toLowerCase();
    const expectedFormat = ALLOWED_IMAGE_MIMES[declaredMime];
    if (!expectedFormat) {
      throw new BadRequestException(
        'Unsupported image format. Accepted formats: JPEG, JPG, PNG, WEBP',
      );
    }

    const detectedFormat = this.detectImageFormat(file.buffer);
    if (!detectedFormat) {
      throw new BadRequestException(
        'File content is not a valid JPEG, PNG, or WEBP image',
      );
    }

    if (detectedFormat !== expectedFormat) {
      throw new BadRequestException(
        'File content does not match the declared image format',
      );
    }

    const normalizedMime =
      detectedFormat === 'jpg'
        ? 'image/jpeg'
        : detectedFormat === 'png'
          ? 'image/png'
          : 'image/webp';

    // Never trust client filenames; generate a random UUID key.
    const storageKey = `reports/${randomUUID()}.${detectedFormat}`;

    await this.storageService.uploadFile(
      storageKey,
      file.buffer,
      normalizedMime,
    );
    const previewUrl =
      await this.storageService.createSignedPreviewUrl(storageKey);

    return {
      storageKey,
      previewUrl,
      mimeType: normalizedMime,
      size: file.size,
    };
  }

  /**
   * Inspects file magic bytes to verify genuine JPEG, PNG, or WEBP content
   * and block renamed executable or text files.
   */
  private detectImageFormat(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
    if (!buffer || buffer.length < 12) {
      return null;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'png';
    }

    // WEBP: "RIFF" .... "WEBP"
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'webp';
    }

    return null;
  }
}

