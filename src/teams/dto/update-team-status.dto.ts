import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateTeamStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive: boolean;
}

