import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ReportPriority } from '../../common/enums/report-priority.enum';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { WasteCategory } from '../../common/enums/waste-category.enum';

export class QueryReportsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WasteCategory })
  @IsOptional()
  @IsEnum(WasteCategory)
  category?: WasteCategory;

  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: ReportPriority })
  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId({ message: 'Invalid assigned team ID' })
  assignedTeamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceArea?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'priority', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'priority', 'status'])
  sortBy?: 'createdAt' | 'priority' | 'status' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

