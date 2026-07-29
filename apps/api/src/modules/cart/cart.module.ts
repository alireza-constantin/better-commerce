import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { InventoryModule } from '../inventory';
import { PricingModule } from '../pricing';
import { ShippingModule } from '../shipping';
import { CartClaim } from './cart-claim.entity';
import { CartLine } from './cart-line.entity';
import { CART_MODULE_CONTRACT } from './cart.contract';
import { CartController } from './cart.controller';
import { Cart } from './cart.entity';
import { CartService } from './cart.service';
import { CartTokenService } from './cart-token.service';
import { CartPersistence } from './persistence/cart.persistence';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartLine, CartClaim]),
    CatalogModule,
    PricingModule,
    InventoryModule,
    ShippingModule,
  ],
  controllers: [CartController],
  providers: [
    CartService,
    CartTokenService,
    CartPersistence,
    { provide: CART_MODULE_CONTRACT, useExisting: CartService },
  ],
  exports: [CART_MODULE_CONTRACT, CartService],
})
export class CartModule {}
