import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStaffByEmailDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ maxItems: 20, type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  roleKeys: string[];
}
