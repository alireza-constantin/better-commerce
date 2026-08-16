import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
  Max,
} from 'class-validator';
import { ManualPaymentMethod, ManualPaymentStatus } from '../payments';
import { CommerceOrderStatus } from './commerce-order.entity';

export class SubmitOrderLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  variantId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DeliveryAddressDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @Length(1, 160)
  recipientName!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @Length(3, 40)
  phone!: string;

  @ApiProperty({ example: 'US', maxLength: 2, minLength: 2 })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
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

  @ApiPropertyOptional({ maxLength: 240, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  line2?: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @Length(1, 32)
  postalCode!: string;
}

export class SubmitOrderDto {
  @ApiProperty({ type: () => [SubmitOrderLineDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SubmitOrderLineDto)
  lines!: SubmitOrderLineDto[];

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  shippingMethodId!: string;

  @ApiProperty({ enum: ManualPaymentMethod })
  @IsEnum(ManualPaymentMethod)
  paymentMethod!: ManualPaymentMethod;

  @ApiProperty({ type: () => DeliveryAddressDto })
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress!: DeliveryAddressDto;

  @ApiPropertyOptional({ type: String, maxLength: 64, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promotionCode?: string | null;
}

export class SubmitCartOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  cartId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  cartVersion!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  shippingMethodId!: string;

  @ApiProperty({ enum: ManualPaymentMethod })
  @IsEnum(ManualPaymentMethod)
  paymentMethod!: ManualPaymentMethod;

  @ApiProperty({ type: () => DeliveryAddressDto })
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress!: DeliveryAddressDto;

  @ApiPropertyOptional({ type: String, maxLength: 64, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  promotionCode?: string | null;
}

export class OrderDecisionDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ConfirmManualPaymentDto extends OrderDecisionDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reference?: string;
}

export class OrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned as `nextCursor` by the previous page.',
    maxLength: 512,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({ default: 25, maximum: 100, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class OrderLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty()
  productTitle!: string;

  @ApiProperty({ nullable: true, type: String })
  variantTitle!: string | null;

  @ApiProperty({ nullable: true, type: String })
  sku!: string | null;

  @ApiProperty({ enum: ['physical', 'digital', 'service'] })
  fulfillmentClassification!: 'physical' | 'digital' | 'service';

  @ApiProperty({ minimum: 1 })
  quantity!: number;

  @ApiProperty({ format: 'uuid' })
  priceVersionId!: string;

  @ApiProperty({ example: '120.00', pattern: '^\\d+(\\.\\d+)?$' })
  unitAmount!: string;

  @ApiProperty({ example: '240.00', pattern: '^\\d+(\\.\\d+)?$' })
  lineAmount!: string;
}

export class OrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '1001' })
  orderNumber!: string;

  @ApiProperty({ enum: CommerceOrderStatus })
  status!: CommerceOrderStatus;

  @ApiProperty({ example: 'USD', maxLength: 3, minLength: 3 })
  currency!: string;

  @ApiProperty({ example: '240.00' })
  merchandiseSubtotal!: string;

  @ApiProperty({ example: '0.00' })
  discountTotal!: string;

  @ApiProperty({ example: '10.00' })
  shippingAmount!: string;

  @ApiProperty({ example: '250.00' })
  grandTotal!: string;

  @ApiProperty({ enum: ManualPaymentMethod })
  paymentMethod!: ManualPaymentMethod;

  @ApiProperty({ enum: ManualPaymentStatus })
  paymentStatus!: ManualPaymentStatus;

  @ApiProperty()
  shippingMethodTitle!: string;

  @ApiProperty({ type: () => DeliveryAddressDto })
  deliveryAddress!: DeliveryAddressDto;

  @ApiProperty({ format: 'date-time' })
  submittedAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  acceptedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  cancelledAt!: string | null;

  @ApiProperty({ type: () => [OrderLineResponseDto] })
  lines!: OrderLineResponseDto[];
}

export class OrdersPageResponseDto {
  @ApiProperty({ type: () => [OrderResponseDto] })
  items!: OrderResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class ManualPaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  orderId!: string;

  @ApiProperty({ enum: ManualPaymentMethod })
  method!: ManualPaymentMethod;

  @ApiProperty({ enum: ManualPaymentStatus })
  status!: ManualPaymentStatus;

  @ApiProperty({
    type: 'object',
    properties: {
      amount: { type: 'string', example: '250.00' },
      currency: { type: 'string', example: 'USD' },
    },
    required: ['amount', 'currency'],
  })
  expectedAmount!: { amount: string; currency: string };
}
