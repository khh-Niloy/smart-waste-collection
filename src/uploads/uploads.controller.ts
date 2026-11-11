import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  MAX_PHOTO_SIZE_BYTES,
  UploadedPhotoResult,
  UploadsService,
} from './uploads.service';

@ApiTags('Uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('photo')
  @ApiOperation({
    summary: 'Upload a waste-site photograph (JPEG, JPG, PNG, WEBP up to 5 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Photograph uploaded to Supabase' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype.toLowerCase())) {
          cb(
            new BadRequestException(
              'Unsupported image format. Accepted formats: JPEG, JPG, PNG, WEBP',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadPhoto(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadedPhotoResult> {
    return this.uploadsService.uploadReportPhoto(file);
  }
}
