import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '../../common/enums/report-status.enum';

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus, { message: 'Invalid report status' })
  status: ReportStatus;

  @ApiPropertyOptional({
    example: 'Crew dispatched to site for morning collection.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Note must not exceed 500 characters' })
  note?: string;
}

