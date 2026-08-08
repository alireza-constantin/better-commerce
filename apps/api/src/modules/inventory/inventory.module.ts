import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { InventoryAdjustment } from './inventory-adjustment.entity';
import { InventoryItem } from './inventory-item.entity';
import { InventoryReservation } from './inventory-reservation.entity';
import { INVENTORY_MODULE_CONTRACT } from './inventory.contract';
import { InventoryService } from './persistence/inventory.service';
import { InventoryAdminController } from './inventory.controller';
import { ReservationExpiryService } from './reservation-expiry.service';
import { CommerceAuditModule } from '../commerce-audit';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryReservation,
      InventoryAdjustment,
    ]),
    CatalogModule,
    CommerceAuditModule,
  ],
  providers: [
    InventoryService,
    ReservationExpiryService,
    { provide: INVENTORY_MODULE_CONTRACT, useExisting: InventoryService },
  ],
  controllers: [InventoryAdminController],
  exports: [INVENTORY_MODULE_CONTRACT, InventoryService],
})
export class InventoryModule {}
