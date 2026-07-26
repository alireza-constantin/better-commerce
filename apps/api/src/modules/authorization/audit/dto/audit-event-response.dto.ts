import { ApiProperty } from '@nestjs/swagger';

export class AuditEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  actorUserId!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  targetType!: string;

  @ApiProperty()
  targetId!: string;

  @ApiProperty({ nullable: true, type: String })
  requestId!: string | null;

  @ApiProperty({ additionalProperties: true, type: 'object' })
  metadata!: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AuditEventPageResponseDto {
  @ApiProperty({ type: () => [AuditEventResponseDto] })
  data!: AuditEventResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}
