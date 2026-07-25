import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { PriceVersion } from './price-version.entity';
import { PRICING_MODULE_CONTRACT } from './pricing.contract';
import { PricingService } from './pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([PriceVersion]), CatalogModule],
  providers: [
    PricingService,
    { provide: PRICING_MODULE_CONTRACT, useExisting: PricingService },
  ],
  exports: [PRICING_MODULE_CONTRACT],
})
export class PricingModule {}
