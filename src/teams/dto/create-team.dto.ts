import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Zone A Rapid Sanitation Unit' })
  @IsString()
  @IsNotEmpty({ message: 'Team name is required' })
  @MinLength(2)
  @MaxLength(120)
  teamName: string;

  @ApiProperty({ example: 'Tariq Mahmud' })
  @IsString()
  @IsNotEmpty({ message: 'Contact person is required' })
  @MinLength(2)
  @MaxLength(100)
  contactPerson: string;

  @ApiProperty({ example: '+8801711223344' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @MinLength(5)
  @MaxLength(30)
  phone: string;

  @ApiProperty({ example: 'Dhanmondi & Ward 15' })
  @IsString()
  @IsNotEmpty({ message: 'Service area is required' })
  @MinLength(2)
  @MaxLength(150)
  serviceArea: string;
}
