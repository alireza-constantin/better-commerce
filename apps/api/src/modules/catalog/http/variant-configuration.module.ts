import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog.module';
import { PricingModule } from '../../pricing';
import { InventoryModule } from '../../inventory';
import { VariantConfigurationController } from './variant-configuration.controller';
import { CommerceAuditModule } from '../../commerce-audit';

@Module({
  imports: [CatalogModule, PricingModule, InventoryModule, CommerceAuditModule],
  controllers: [VariantConfigurationController],
})
export class VariantConfigurationModule {}
