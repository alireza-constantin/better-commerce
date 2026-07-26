import { ApiProperty } from '@nestjs/swagger';
import { PermissionKey, StaffProfileStatus } from '../../data';

export class StaffProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ enum: StaffProfileStatus })
  status!: StaffProfileStatus;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ enum: PermissionKey, isArray: true })
  permissions!: string[];
}

export class StaffPageResponseDto {
  @ApiProperty({ type: () => [StaffProfileResponseDto] })
  data!: StaffProfileResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class RoleResponseDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: PermissionKey, isArray: true })
  permissions!: string[];
}
