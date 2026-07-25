import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingMethod } from './shipping-method.entity';
import { ShippingRateRule } from './shipping-rate-rule.entity';
import { SHIPPING_MODULE_CONTRACT } from './shipping.contract';
import { ShippingService } from './shipping.service';
import { ShippingZone } from './shipping-zone.entity';
import { ShippingAdminController } from './shipping.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShippingZone, ShippingMethod, ShippingRateRule])],
  providers: [ShippingService, { provide: SHIPPING_MODULE_CONTRACT, useExisting: ShippingService }],
  controllers: [ShippingAdminController],
  exports: [SHIPPING_MODULE_CONTRACT],
})
export class ShippingModule {}
