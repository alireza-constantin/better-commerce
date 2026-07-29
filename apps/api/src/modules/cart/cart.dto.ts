import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CartVersionDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class SetCartLineDto extends CartVersionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class CartLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: 999 })
  quantity!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  productTitle!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  variantTitle!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    properties: {
      amount: { type: 'string' },
      currency: { type: 'string' },
    },
  })
  price!: { amount: string; currency: string } | null;

  @ApiProperty({ enum: ['in_stock', 'out_of_stock', 'unavailable'] })
  availability!: 'in_stock' | 'out_of_stock' | 'unavailable';

  @ApiProperty()
  purchasable!: boolean;
}

export class CartResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  id!: string | null;

  @ApiProperty({ minimum: 0 })
  version!: number;

  @ApiProperty({ enum: ['active'] })
  status!: 'active';

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  expiresAt!: Date | null;

  @ApiProperty({ type: () => [CartLineResponseDto] })
  lines!: CartLineResponseDto[];
}
