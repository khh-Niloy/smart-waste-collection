import { BadRequestException } from '@nestjs/common';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { MAX_PHOTO_SIZE_BYTES, UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let storageService: {
    uploadFile: jest.Mock;
    createSignedPreviewUrl: jest.Mock;
  };

  beforeEach(() => {
    storageService = {
      uploadFile: jest.fn().mockResolvedValue(undefined),
      createSignedPreviewUrl: jest
        .fn()
        .mockResolvedValue('https://example.supabase.co/signed/photo.jpg'),
    };
    service = new UploadsService(
      storageService as unknown as SupabaseStorageService,
    );
  });

  it('uploads valid PNG buffer using randomized storage key', async () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const file = {
      originalname: '../../evil-script.exe.png',
      mimetype: 'image/png',
      size: pngHeader.length,
      buffer: pngHeader,
    } as Express.Multer.File;

    const result = await service.uploadReportPhoto(file);

    expect(result.storageKey).toMatch(/^reports\/[a-f0-9-]+\.png$/);
    expect(result.storageKey).not.toContain('evil-script');
    expect(result.previewUrl).toBe(
      'https://example.supabase.co/signed/photo.jpg',
    );
    expect(storageService.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized files (> 5 MB)', async () => {
    const file = {
      originalname: 'large.jpg',
      mimetype: 'image/jpeg',
      size: MAX_PHOTO_SIZE_BYTES + 1,
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    } as Express.Multer.File;

    await expect(service.uploadReportPhoto(file)).rejects.toThrow(
      BadRequestException,
    );
    expect(storageService.uploadFile).not.toHaveBeenCalled();
  });

  it('rejects executable or spoofed content masquerading as JPEG', async () => {
    const exeHeader = Buffer.from('MZ\x90\x00ThisIsAnExecutableFile');
    const file = {
      originalname: 'payload.jpg',
      mimetype: 'image/jpeg',
      size: exeHeader.length,
      buffer: exeHeader,
    } as Express.Multer.File;

    await expect(service.uploadReportPhoto(file)).rejects.toThrow(
      BadRequestException,
    );
    expect(storageService.uploadFile).not.toHaveBeenCalled();
  });
});
