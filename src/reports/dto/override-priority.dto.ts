import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ReportPriority } from '../../common/enums/report-priority.enum';

export class OverridePriorityDto {
  @ApiProperty({ enum: ReportPriority })
  @IsEnum(ReportPriority, { message: 'Invalid priority value' })
  priority: ReportPriority;

  @ApiProperty({
    example: 'Site inspection confirmed proximity to primary school gate.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Override reason is required' })
  @MinLength(5, {
    message: 'Override reason must be at least 5 characters long',
  })
  @MaxLength(500, {
    message: 'Override reason must not exceed 500 characters',
  })
  reason: string;
}

