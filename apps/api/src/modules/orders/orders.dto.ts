import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ManualPaymentMethod } from '../payments';

export class SubmitOrderLineDto {
  @IsUUID('4')
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DeliveryAddressDto {
  @IsString()
  @Length(1, 160)
  recipientName!: string;

  @IsString()
  @Length(3, 40)
  phone!: string;

  @IsString()
  @Length(2, 2)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsString()
  @Length(1, 120)
  city!: string;

  @IsString()
  @Length(1, 240)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  line2?: string;

  @IsString()
  @Length(1, 32)
  postalCode!: string;
}

export class SubmitOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SubmitOrderLineDto)
  lines!: SubmitOrderLineDto[];

  @IsUUID('4')
  shippingMethodId!: string;

  @IsEnum(ManualPaymentMethod)
  paymentMethod!: ManualPaymentMethod;

  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress!: DeliveryAddressDto;
}

export class OrderDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ConfirmManualPaymentDto extends OrderDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reference?: string;
}
