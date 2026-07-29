import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { CommerceAuditModule } from '../commerce-audit';
import { InventoryModule } from '../inventory';
import { PaymentsModule } from '../payments';
import { PricingModule } from '../pricing';
import { ShippingModule } from '../shipping';
import { CartModule } from '../cart';
import { CommerceOrderLine } from './commerce-order-line.entity';
import { CommerceOrder } from './commerce-order.entity';
import {
  AdminOrdersController,
  CustomerOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersPersistence } from './persistence/orders.persistence';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommerceOrder, CommerceOrderLine]),
    CatalogModule,
    PricingModule,
    InventoryModule,
    ShippingModule,
    PaymentsModule,
    CommerceAuditModule,
    CartModule,
  ],
  controllers: [CustomerOrdersController, AdminOrdersController],
  providers: [OrdersService, OrdersPersistence],
  exports: [OrdersService],
})
export class OrdersModule {}
