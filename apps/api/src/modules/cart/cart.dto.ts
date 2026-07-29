import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ManualPaymentMethod } from '../payments';

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

export class CartDeliveryAddressDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @Length(1, 160)
  recipientName!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @Length(3, 40)
  phone!: string;

  @ApiProperty({ minLength: 2, maxLength: 2, example: 'IR' })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  city!: string;

  @ApiProperty({ maxLength: 240 })
  @IsString()
  @Length(1, 240)
  line1!: string;

  @ApiPropertyOptional({ maxLength: 240, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  line2?: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @Length(1, 32)
  postalCode!: string;
}

export class PrepareCartCheckoutDto extends CartVersionDto {
  @ApiProperty({ type: () => CartDeliveryAddressDto })
  @ValidateNested()
  @Type(() => CartDeliveryAddressDto)
  deliveryAddress!: CartDeliveryAddressDto;
}

export class CartShippingQuoteResponseDto {
  @ApiProperty({ format: 'uuid' })
  methodId!: string;

  @ApiProperty()
  methodTitle!: string;

  @ApiProperty({
    type: 'object',
    properties: {
      amount: { type: 'string' },
      currency: { type: 'string' },
    },
    required: ['amount', 'currency'],
  })
  charge!: { amount: string; currency: string };

  @ApiProperty({
    type: 'object',
    properties: {
      amount: { type: 'string' },
      currency: { type: 'string' },
    },
    required: ['amount', 'currency'],
  })
  grandTotal!: { amount: string; currency: string };
}

export class CartCheckoutPreparationResponseDto {
  @ApiProperty({ format: 'uuid' })
  cartId!: string;

  @ApiProperty({ minimum: 1 })
  cartVersion!: number;

  @ApiProperty({
    type: 'object',
    properties: {
      amount: { type: 'string' },
      currency: { type: 'string' },
    },
    required: ['amount', 'currency'],
  })
  merchandiseSubtotal!: { amount: string; currency: string };

  @ApiProperty({ type: () => [CartShippingQuoteResponseDto] })
  shippingMethods!: CartShippingQuoteResponseDto[];

  @ApiProperty({ enum: ManualPaymentMethod, isArray: true })
  paymentMethods!: ManualPaymentMethod[];
}
