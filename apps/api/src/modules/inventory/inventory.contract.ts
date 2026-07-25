import type { DatabaseTransactionContext } from '../../platform/database';

export const INVENTORY_MODULE_CONTRACT = Symbol('inventory-module-contract');

export interface InventoryReservationReference {
  readonly id: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly expiresAt: Date;
}

export interface InventoryModuleContract {
  reserve(
    lines: readonly { variantId: string; quantity: number }[],
    correlationKey: string,
    holdMinutes: number,
    transaction?: DatabaseTransactionContext,
  ): Promise<readonly InventoryReservationReference[]>;
  commit(
    reservationIds: readonly string[],
    orderId: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<void>;
  release(
    reservationIds: readonly string[],
    reason: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<void>;
}
