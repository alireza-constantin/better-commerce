import { ApiProperty } from '@nestjs/swagger';

export class ShippingZoneResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ example: 'US' })
  country!: string;
  @ApiProperty({ nullable: true, type: String })
  province!: string | null;
  @ApiProperty({ nullable: true, type: String })
  city!: string | null;
  @ApiProperty({ nullable: true, type: String })
  postalPrefix!: string | null;
  @ApiProperty()
  active!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ShippingMethodResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  zoneId!: string;
  @ApiProperty()
  title!: string;
  @ApiProperty()
  position!: number;
  @ApiProperty()
  active!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ShippingRateRuleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  methodId!: string;
  @ApiProperty({ example: '0.00' })
  minimumSubtotal!: string;
  @ApiProperty({ example: '100.00', nullable: true, type: String })
  maximumSubtotal!: string | null;
  @ApiProperty({ example: '5.00' })
  amount!: string;
  @ApiProperty({ example: 'USD' })
  currency!: string;
  @ApiProperty()
  active!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ShippingConfigurationResponseDto {
  @ApiProperty({ type: () => [ShippingZoneResponseDto] })
  zones!: ShippingZoneResponseDto[];
  @ApiProperty({ type: () => [ShippingMethodResponseDto] })
  methods!: ShippingMethodResponseDto[];
  @ApiProperty({ type: () => [ShippingRateRuleResponseDto] })
  rules!: ShippingRateRuleResponseDto[];
}
