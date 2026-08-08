import { ApiProperty } from '@nestjs/swagger';

export class PriceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ example: '120.00' })
  amount!: string;

  @ApiProperty({ example: 'USD', maxLength: 3, minLength: 3 })
  currency!: string;

  @ApiProperty({ format: 'date-time' })
  effectiveFrom!: string;
}

export class CurrentPriceResponseDto {
  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  priceVersionId!: string | null;

  @ApiProperty({ example: '120.00', nullable: true, type: String })
  amount!: string | null;

  @ApiProperty({
    example: 'USD',
    maxLength: 3,
    minLength: 3,
    nullable: true,
    type: String,
  })
  currency!: string | null;

  @ApiProperty({ enum: ['priced', 'price_on_request'] })
  state!: 'priced' | 'price_on_request';
}
