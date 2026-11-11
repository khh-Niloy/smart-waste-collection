import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private bucketEnsured = false;

  constructor(private readonly configService: ConfigService) {}

  private get bucket(): string {
    return this.configService.get<string>('supabase.bucket') || 'waste-reports';
  }

  isConfigured(): boolean {
    const url = this.configService.get<string>('supabase.url');
    const secretKey = this.configService.get<string>('supabase.secretKey');
    return Boolean(url && secretKey);
  }

  private getClient(): SupabaseClient {
    const url = this.configService.get<string>('supabase.url');
    const secretKey = this.configService.get<string>('supabase.secretKey');

    if (!url || !secretKey) {
      throw new ServiceUnavailableException(
        'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.',
      );
    }

    if (!this.client) {
      this.client = createClient(url, secretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    return this.client;
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) return;
    const client = this.getClient();
    const { error: getError } = await client.storage.getBucket(this.bucket);
    if (!getError) {
      this.bucketEnsured = true;
      return;
    }

    const { error: createError } = await client.storage.createBucket(
      this.bucket,
      {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      },
    );

    if (
      createError &&
      !createError.message.toLowerCase().includes('already exists')
    ) {
      throw new InternalServerErrorException(
        `Unable to initialize storage bucket: ${createError.message}`,
      );
    }
    this.bucketEnsured = true;
  }

  async uploadFile(
    storageKey: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.ensureBucket();
    const { error } = await this.getClient()
      .storage.from(this.bucket)
      .upload(storageKey, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Unable to upload waste-site photograph: ${error.message}`,
      );
    }
  }

  async createSignedPreviewUrl(
    storageKey: string,
    expiresIn = 3600,
  ): Promise<string> {
    const { data, error } = await this.getClient()
      .storage.from(this.bucket)
      .createSignedUrl(storageKey, expiresIn);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(
        `Unable to create photograph preview URL: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return data.signedUrl;
  }
}
