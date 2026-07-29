import type { DatabaseTransactionContext } from '../../platform/database';
import type { CheckoutCart } from './cart.types';

export const CART_MODULE_CONTRACT = Symbol('cart-module-contract');

export interface CartModuleContract {
  lockForCheckout(
    userId: string,
    cartId: string,
    expectedVersion: number,
    transaction: DatabaseTransactionContext,
  ): Promise<CheckoutCart>;
  completeCheckout(
    cartId: string,
    expectedVersion: number,
    transaction: DatabaseTransactionContext,
  ): Promise<void>;
}
