import type { DatabaseTransactionContext } from '../../platform/database';

export const INVENTORY_MODULE_CONTRACT = Symbol('inventory-module-contract');

export interface InventoryReservationReference {
  readonly id: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly expiresAt: Date;
}

export type PublicVariantAvailability =
  'in_stock' | 'out_of_stock' | 'unavailable';

export interface PublicVariantAvailabilityProjection {
  readonly variantId: string;
  readonly availability: PublicVariantAvailability;
}

export interface InventoryModuleContract {
  /** Returns a conservative display state without exposing stock quantities. */
  readPublicVariantAvailability(
    variantIds: readonly string[],
  ): Promise<readonly PublicVariantAvailabilityProjection[]>;
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
