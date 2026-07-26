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

  @ApiProperty({ format: 'uuid' })
  priceVersionId!: string;

  @ApiProperty({ example: '120.00' })
  amount!: string;

  @ApiProperty({ example: 'USD', maxLength: 3, minLength: 3 })
  currency!: string;
}
