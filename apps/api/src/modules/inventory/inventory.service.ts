import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import { CATALOG_MODULE_CONTRACT, type CatalogModuleContract } from '../catalog';
import { InventoryAdjustment } from './inventory-adjustment.entity';
import { InventoryItem, InventoryTrackingMode } from './inventory-item.entity';
import {
  InventoryReservation,
  InventoryReservationStatus,
} from './inventory-reservation.entity';
import type {
  InventoryModuleContract,
  InventoryReservationReference,
} from './inventory.contract';

@Injectable()
export class InventoryService implements InventoryModuleContract {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CATALOG_MODULE_CONTRACT)
    private readonly catalog: CatalogModuleContract,
  ) {}

  async configure(
    variantId: string,
    trackingMode: InventoryTrackingMode,
    initialOnHand: number,
    actorUserId: string,
  ) {
    if (!Number.isSafeInteger(initialOnHand) || initialOnHand < 0)
      throw new Error('Initial on-hand quantity is invalid');
    const [variant] = await this.catalog.resolvePurchasableVariants([variantId]);
    if (!variant) throw new Error('Variant was not found');
    return this.dataSource.transaction(async (manager) => {
      const items = manager.getRepository(InventoryItem);
      let item = await items.findOne({ where: { variantId }, lock: { mode: 'pessimistic_write' } });
      if (!item) {
        item = items.create({
          variantId,
          trackingMode,
          onHand: initialOnHand,
          reservedQuantity: 0,
          version: 1,
        });
      } else {
        if (item.reservedQuantity > initialOnHand)
          throw new Error('Initial quantity cannot be below reserved quantity');
        item.trackingMode = trackingMode;
        item.onHand = initialOnHand;
        item.version += 1;
      }
      await items.save(item);
      await manager.getRepository(InventoryAdjustment).save({
        inventoryItemId: item.id,
        variantId,
        delta: initialOnHand,
        resultingOnHand: initialOnHand,
        reasonCode: 'initial_stock',
        note: null,
        actorUserId,
      });
      return this.toView(item);
    });
  }

  async adjust(
    variantId: string,
    delta: number,
    reasonCode: string,
    actorUserId: string,
    note?: string,
  ) {
    if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('Adjustment delta is invalid');
    return this.dataSource.transaction(async (manager) => {
      const item = await this.lockItem(manager, variantId);
      if (item.trackingMode !== InventoryTrackingMode.TRACKED)
        throw new Error('Untracked Variant cannot be adjusted');
      const next = item.onHand + delta;
      if (next < item.reservedQuantity) throw new Error('Adjustment would consume reserved stock');
      item.onHand = next;
      item.version += 1;
      await manager.getRepository(InventoryItem).save(item);
      await manager.getRepository(InventoryAdjustment).save({
        inventoryItemId: item.id,
        variantId,
        delta,
        resultingOnHand: next,
        reasonCode,
        note: note?.trim() || null,
        actorUserId,
      });
      return this.toView(item);
    });
  }

  async reserve(
    lines: readonly { variantId: string; quantity: number }[],
    correlationKey: string,
    holdMinutes: number,
  ): Promise<readonly InventoryReservationReference[]> {
    const normalized = this.normalizeLines(lines);
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(InventoryReservation).find({
        where: { correlationKey },
      });
      if (existing.length) return existing.map((reservation) => this.toReservationReference(reservation));
      const expiresAt = new Date(Date.now() + holdMinutes * 60_000);
      const results: InventoryReservationReference[] = [];
      for (const line of normalized) {
        const item = await this.lockItem(manager, line.variantId);
        await this.expireStale(manager, item);
        if (item.trackingMode === InventoryTrackingMode.UNTRACKED) continue;
        if (item.onHand - item.reservedQuantity < line.quantity)
          throw new Error('Insufficient inventory');
        item.reservedQuantity += line.quantity;
        item.version += 1;
        await manager.getRepository(InventoryItem).save(item);
        const reservation = manager.getRepository(InventoryReservation).create({
          inventoryItemId: item.id,
          variantId: line.variantId,
          quantity: line.quantity,
          correlationKey,
          status: InventoryReservationStatus.ACTIVE,
          expiresAt,
          terminalAt: null,
          terminalReason: null,
          orderId: null,
        });
        await manager.getRepository(InventoryReservation).save(reservation);
        results.push(this.toReservationReference(reservation));
      }
      return results;
    });
  }

  async commit(reservationIds: readonly string[], orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const reservations = await manager.getRepository(InventoryReservation).find({
        where: { id: In([...new Set(reservationIds)]) },
        lock: { mode: 'pessimistic_write' },
      });
      if (reservations.length !== new Set(reservationIds).size) throw new Error('Reservation was not found');
      for (const reservation of reservations.sort((a, b) => a.variantId.localeCompare(b.variantId))) {
        const item = await this.lockItem(manager, reservation.variantId);
        await this.expireStale(manager, item);
        if (reservation.status !== InventoryReservationStatus.ACTIVE || reservation.expiresAt <= new Date())
          throw new Error('Reservation is not active');
        item.onHand -= reservation.quantity;
        item.reservedQuantity -= reservation.quantity;
        item.version += 1;
        reservation.status = InventoryReservationStatus.COMMITTED;
        reservation.orderId = orderId;
        reservation.terminalAt = new Date();
        reservation.terminalReason = 'order_accepted';
        await manager.getRepository(InventoryItem).save(item);
        await manager.getRepository(InventoryReservation).save(reservation);
        await manager.getRepository(InventoryAdjustment).save({
          inventoryItemId: item.id,
          variantId: item.variantId,
          delta: -reservation.quantity,
          resultingOnHand: item.onHand,
          reasonCode: 'reservation_committed',
          note: null,
          actorUserId: null,
        });
      }
    });
  }

  async release(reservationIds: readonly string[], reason: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const reservations = await manager.getRepository(InventoryReservation).find({
        where: { id: In([...new Set(reservationIds)]) },
        lock: { mode: 'pessimistic_write' },
      });
      for (const reservation of reservations) {
        if (reservation.status !== InventoryReservationStatus.ACTIVE) continue;
        const item = await this.lockItem(manager, reservation.variantId);
        item.reservedQuantity -= reservation.quantity;
        item.version += 1;
        reservation.status = InventoryReservationStatus.RELEASED;
        reservation.terminalAt = new Date();
        reservation.terminalReason = reason;
        await manager.getRepository(InventoryItem).save(item);
        await manager.getRepository(InventoryReservation).save(reservation);
      }
    });
  }

  private async lockItem(manager: EntityManager, variantId: string) {
    const item = await manager.getRepository(InventoryItem).findOne({
      where: { variantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!item) throw new Error(`Inventory is not configured for Variant ${variantId}`);
    return item;
  }

  private async expireStale(manager: EntityManager, item: InventoryItem): Promise<void> {
    const stale = await manager.getRepository(InventoryReservation).find({
      where: { inventoryItemId: item.id, status: InventoryReservationStatus.ACTIVE },
      lock: { mode: 'pessimistic_write' },
    });
    const now = new Date();
    for (const reservation of stale.filter((value) => value.expiresAt <= now)) {
      item.reservedQuantity -= reservation.quantity;
      reservation.status = InventoryReservationStatus.EXPIRED;
      reservation.terminalAt = now;
      reservation.terminalReason = 'expired';
      await manager.getRepository(InventoryReservation).save(reservation);
    }
    if (stale.some((value) => value.expiresAt <= now)) {
      item.version += 1;
      await manager.getRepository(InventoryItem).save(item);
    }
  }

  private normalizeLines(lines: readonly { variantId: string; quantity: number }[]) {
    const quantities = new Map<string, number>();
    for (const line of lines) {
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1)
        throw new Error('Reservation quantity is invalid');
      quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
    }
    return [...quantities].map(([variantId, quantity]) => ({ variantId, quantity }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId));
  }

  private toReservationReference(reservation: InventoryReservation): InventoryReservationReference {
    return { id: reservation.id, variantId: reservation.variantId, quantity: reservation.quantity, expiresAt: reservation.expiresAt };
  }

  private toView(item: InventoryItem) {
    return {
      id: item.id,
      variantId: item.variantId,
      trackingMode: item.trackingMode,
      onHand: item.onHand,
      reservedQuantity: item.reservedQuantity,
      available: item.onHand - item.reservedQuantity,
      version: item.version,
    };
  }
}
