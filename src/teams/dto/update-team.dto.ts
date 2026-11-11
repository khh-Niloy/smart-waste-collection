import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: 'Zone A Rapid Sanitation Unit' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  teamName?: string;

  @ApiPropertyOptional({ example: 'Tariq Mahmud' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  contactPerson?: string;

  @ApiPropertyOptional({ example: '+8801711223344' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'Dhanmondi & Ward 15' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  serviceArea?: string;
}

