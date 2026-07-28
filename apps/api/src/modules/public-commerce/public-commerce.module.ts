import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog';
import { InventoryModule } from '../inventory';
import { PricingModule } from '../pricing';
import { PublicCommerceController } from './public-commerce.controller';
import { PublicCommerceService } from './public-commerce.service';

@Module({
  imports: [CatalogModule, PricingModule, InventoryModule],
  controllers: [PublicCommerceController],
  providers: [PublicCommerceService],
})
export class PublicCommerceModule {}
