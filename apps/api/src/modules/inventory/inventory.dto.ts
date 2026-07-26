import { ApiProperty } from '@nestjs/swagger';
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
