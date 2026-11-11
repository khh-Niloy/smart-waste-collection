import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Hasib Hossain Niloy' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName: string;

  @ApiPropertyOptional({ example: '+8801915910291' })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Phone number must not exceed 30 characters' })
  phone?: string;
}
