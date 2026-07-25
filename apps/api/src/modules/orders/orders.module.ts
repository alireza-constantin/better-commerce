import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { InventoryModule } from '../inventory';
import { PaymentsModule } from '../payments';
import { PricingModule } from '../pricing';
import { ShippingModule } from '../shipping';
import { CommerceOrderLine } from './commerce-order-line.entity';
import { CommerceOrder } from './commerce-order.entity';
import {
  AdminOrdersController,
  CustomerOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommerceOrder, CommerceOrderLine]),
    CatalogModule,
    PricingModule,
    InventoryModule,
    ShippingModule,
    PaymentsModule,
  ],
  controllers: [CustomerOrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
