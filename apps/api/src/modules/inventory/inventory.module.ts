import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { InventoryAdjustment } from './inventory-adjustment.entity';
import { InventoryItem } from './inventory-item.entity';
import { InventoryReservation } from './inventory-reservation.entity';
import { INVENTORY_MODULE_CONTRACT } from './inventory.contract';
import { InventoryService } from './inventory.service';
import { InventoryAdminController } from './inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, InventoryReservation, InventoryAdjustment]), CatalogModule],
  providers: [InventoryService, { provide: INVENTORY_MODULE_CONTRACT, useExisting: InventoryService }],
  controllers: [InventoryAdminController],
  exports: [INVENTORY_MODULE_CONTRACT],
})
export class InventoryModule {}
