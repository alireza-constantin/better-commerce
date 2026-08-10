import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CommerceAuditAction } from './commerce-audit.contract';

export class CommerceAuditQueryDto {
  @ApiPropertyOptional({
    description:
      'Product id used to return product events together with events for its variants.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned as `nextCursor` by the previous page.',
    maxLength: 512,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class CommerceAuditEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  actorUserId!: string | null;

  @ApiProperty({ enum: CommerceAuditAction })
  action!: CommerceAuditAction;

  @ApiProperty()
  targetType!: string;

  @ApiProperty()
  targetId!: string;

  @ApiProperty({ nullable: true, type: String })
  requestId!: string | null;

  @ApiProperty({
    additionalProperties: {
      oneOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
      ],
    },
    type: 'object',
  })
  metadata!: Record<string, string | number | boolean | null>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CommerceAuditPageResponseDto {
  @ApiProperty({ type: () => [CommerceAuditEventResponseDto] })
  items!: CommerceAuditEventResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}
