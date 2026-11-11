import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class DemoLoginDto {
  @ApiProperty({ enum: Role, example: Role.CITIZEN })
  @IsEnum(Role, { message: 'Role must be CITIZEN or ADMIN' })
  role: Role;
}

