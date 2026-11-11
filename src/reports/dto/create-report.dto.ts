import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WasteCategory } from '../../common/enums/waste-category.enum';

export class CreateReportDto {
  @ApiProperty({ enum: WasteCategory })
  @IsEnum(WasteCategory, { message: 'Please select a valid waste category' })
  category: WasteCategory;

  @ApiProperty({
    example:
      'Municipal bin at the corner of Road 12 has been overflowing onto the footpath for two days.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(15, {
    message: 'Description must be at least 15 characters long',
  })
  @MaxLength(2000, {
    message: 'Description must not exceed 2000 characters',
  })
  description: string;

  @ApiProperty({ example: 'Road 12, Dhanmondi, Dhaka, Ward 15' })
  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  @MinLength(5, { message: 'Address must be at least 5 characters long' })
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  address: string;

  @ApiPropertyOptional({ example: 'Road 12' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  street?: string;

  @ApiPropertyOptional({ example: 'Dhanmondi' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  area?: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Ward 15' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ward?: string;

  @ApiPropertyOptional({ example: 23.7465 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude must be a valid number' })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 90.376 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude must be a valid number' })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 'reports/550e8400-e29b-41d4-a716-446655440000.jpg',
    description: 'Supabase storage key returned by POST /api/v1/uploads/photo',
  })
  @IsOptional()
  @IsString()
  @Matches(/^reports\/[a-f0-9-]+\.(jpg|png|webp)$/i, {
    message: 'Invalid photograph storage key format',
  })
  photoUrl?: string;
}
