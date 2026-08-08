import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { InventoryTrackingMode } from './inventory-item.entity';

export class InventoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ enum: InventoryTrackingMode })
  trackingMode!: InventoryTrackingMode;

  @ApiProperty({ minimum: 0 })
  onHand!: number;

  @ApiProperty({ minimum: 0 })
  reservedQuantity!: number;

  @ApiProperty({ minimum: 0 })
  available!: number;

  @ApiProperty({ minimum: 1 })
  version!: number;
}

export class CurrentInventoryQueryDto {
  @ApiProperty({ format: 'uuid', maxItems: 100, type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  variantIds!: string[];
}

export class CurrentInventoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ enum: ['not_configured', 'untracked', 'tracked'] })
  state!: 'not_configured' | 'untracked' | 'tracked';

  @ApiPropertyOptional({ enum: ['tracked', 'untracked'], nullable: true })
  trackingMode!: 'tracked' | 'untracked' | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true, type: Number })
  onHand!: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true, type: Number })
  reservedQuantity!: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true, type: Number })
  available!: number | null;
}
