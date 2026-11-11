import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class AssignTeamDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId({ message: 'Invalid collection team ID' })
  teamId: string;

  @ApiPropertyOptional({ example: 'Assigned to Zone A rapid response crew.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

