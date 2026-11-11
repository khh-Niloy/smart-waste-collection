import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ReportPriority } from '../../common/enums/report-priority.enum';
import { ReportStatus } from '../../common/enums/report-status.enum';
import { WasteCategory } from '../../common/enums/waste-category.enum';

export class MapReportsQueryDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: WasteCategory })
  @IsOptional()
  @IsEnum(WasteCategory)
  category?: WasteCategory;

  @ApiPropertyOptional({ enum: ReportPriority })
  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;
}

