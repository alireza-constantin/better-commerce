import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';
import type { DatabaseTransactionContext } from '../../../platform/database';
import { DatabaseTransactionRunner } from '../../../platform/database';
import { unwrapTypeOrmTransaction } from '../../../platform/database/typeorm-transaction-context';
import {
  CATALOG_MODULE_CONTRACT,
  type CatalogModuleContract,
} from '../../catalog';
import {
  COMMERCE_AUDIT_CONTRACT,
  CommerceAuditAction,
  type CommerceAuditContract,
} from '../../commerce-audit';
import { InventoryAdjustment } from '../inventory-adjustment.entity';
import { InventoryItem, InventoryTrackingMode } from '../inventory-item.entity';
import {
  InventoryReservation,
  InventoryReservationStatus,
} from '../inventory-reservation.entity';
import type {
  InventoryModuleContract,
  InventoryReservationReference,
  PublicVariantAvailabilityProjection,
} from '../inventory.contract';

@Injectable()
export class InventoryService implements InventoryModuleContract {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: DatabaseTransactionRunner,
    @Inject(CATALOG_MODULE_CONTRACT)
    private readonly catalog: CatalogModuleContract,
    @Inject(COMMERCE_AUDIT_CONTRACT)
    private readonly audit: CommerceAuditContract,
  ) {}

  async readPublicVariantAvailability(
    variantIds: readonly string[],
  ): Promise<readonly PublicVariantAvailabilityProjection[]> {
    const ids = [...new Set(variantIds)];
    if (!ids.length) return [];
    const items = await this.dataSource
      .getRepository(InventoryItem)
      .findBy({ variantId: In(ids) });
    const byVariant = new Map(items.map((item) => [item.variantId, item]));

    return ids.map((variantId) => {
      const item = byVariant.get(variantId);
      if (!item) return { variantId, availability: 'unavailable' as const };
      if (item.trackingMode === InventoryTrackingMode.UNTRACKED) {
        return { variantId, availability: 'in_stock' as const };
      }
      return {
        variantId,
        availability:
          item.onHand - item.reservedQuantity > 0
            ? ('in_stock' as const)
            : ('out_of_stock' as const),
      };
    });
  }

  async listCurrentInventory(variantIds: readonly string[]) {
    const ids = [...new Set(variantIds)];
    if (!ids.length) return [];
    const items = await this.dataSource
      .getRepository(InventoryItem)
      .findBy({ variantId: In(ids) });
    const byVariant = new Map(items.map((item) => [item.variantId, item]));
    return ids.map((variantId) => {
      const item = byVariant.get(variantId);
      if (!item)
        return {
          variantId,
          state: 'not_configured' as const,
          trackingMode: null,
          onHand: null,
          reservedQuantity: null,
          available: null,
        };
      if (item.trackingMode === InventoryTrackingMode.UNTRACKED)
        return {
          variantId,
          state: 'untracked' as const,
          trackingMode: item.trackingMode,
          onHand: null,
          reservedQuantity: null,
          available: null,
        };
      return {
        variantId,
        state: 'tracked' as const,
        trackingMode: item.trackingMode,
        onHand: item.onHand,
        reservedQuantity: item.reservedQuantity,
        available: item.onHand - item.reservedQuantity,
      };
    });
  }

  async configure(
    variantId: string,
    trackingMode: InventoryTrackingMode,
    initialOnHand: number,
    actorUserId: string,
    requestId: string | null = null,
  ) {
    if (!Number.isSafeInteger(initialOnHand) || initialOnHand < 0)
      throw new Error('Initial on-hand quantity is invalid');
    const [variant] = await this.catalog.resolvePurchasableVariants([
      variantId,
    ]);
    if (!variant) throw new Error('Variant was not found');
    return this.transactions.run(async (transaction) => {
      const manager = unwrapTypeOrmTransaction(transaction);
      const items = manager.getRepository(InventoryItem);
      let item = await items.findOne({
        where: { variantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) {
        item = items.create({
          variantId,
          trackingMode,
          onHand: initialOnHand,
          reservedQuantity: 0,
          version: 1,
        });
      } else {
        if (item.trackingMode !== trackingMode && item.reservedQuantity !== 0)
          throw new Error(
            'Inventory tracking mode cannot change while stock is reserved',
          );
        if (item.reservedQuantity > initialOnHand)
          throw new Error('Initial quantity cannot be below reserved quantity');
        const previousOnHand = item.onHand;
        item.trackingMode = trackingMode;
        item.onHand = initialOnHand;
        item.version += 1;
        await items.save(item);
        await manager.getRepository(InventoryAdjustment).save({
          inventoryItemId: item.id,
          variantId,
          delta: initialOnHand - previousOnHand,
          resultingOnHand: initialOnHand,
          reasonCode: 'stock_reconfigured',
          note: null,
          actorUserId,
        });
        const view = this.toView(item);
        await this.audit.record(
          {
            actorUserId,
            action: CommerceAuditAction.INVENTORY_CONFIGURED,
            targetType: 'variant',
            targetId: variantId,
            requestId,
            metadata: { trackingMode, onHand: initialOnHand },
          },
          transaction,
        );
        return view;
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
      const view = this.toView(item);
      await this.audit.record(
        {
          actorUserId,
          action: CommerceAuditAction.INVENTORY_CONFIGURED,
          targetType: 'variant',
          targetId: variantId,
          requestId,
          metadata: { trackingMode, onHand: initialOnHand },
        },
        transaction,
      );
      return view;
    });
  }

  async applyCurrentInventory(
    variantId: string,
    trackingMode: InventoryTrackingMode | 'not_configured',
    currentOnHand: number | null,
    reasonCode: string | null,
    note: string | undefined,
    actorUserId: string,
    requestId: string | null,
    transaction: DatabaseTransactionContext,
  ) {
    if (
      trackingMode !== 'not_configured' &&
      trackingMode !== InventoryTrackingMode.TRACKED &&
      trackingMode !== InventoryTrackingMode.UNTRACKED
    )
      throw new Error('Inventory tracking mode is invalid');
    if (
      trackingMode === InventoryTrackingMode.TRACKED &&
      (currentOnHand === null ||
        !Number.isSafeInteger(currentOnHand) ||
        currentOnHand < 0)
    )
      throw new Error('Current on-hand quantity is invalid');
    const manager = unwrapTypeOrmTransaction(transaction);
    const items = manager.getRepository(InventoryItem);
    let item = await items.findOne({
      where: { variantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (trackingMode === 'not_configured') {
      if (!item) return null;
      throw new Error('Configured inventory cannot be cleared');
    }
    const targetOnHand =
      trackingMode === InventoryTrackingMode.UNTRACKED
        ? 0
        : (currentOnHand as number);
    const previousOnHand = item?.onHand ?? 0;
    if (
      item &&
      item.trackingMode === trackingMode &&
      item.onHand === targetOnHand
    )
      return this.toView(item);
    if (!item) {
      item = items.create({
        variantId,
        trackingMode,
        onHand: targetOnHand,
        reservedQuantity: 0,
        version: 1,
      });
    } else {
      if (item.trackingMode !== trackingMode && item.reservedQuantity !== 0)
        throw new Error(
          'Inventory tracking mode cannot change while stock is reserved',
        );
      if (item.reservedQuantity > targetOnHand)
        throw new Error('Current quantity cannot be below reserved quantity');
      item.trackingMode = trackingMode;
      item.onHand = targetOnHand;
      item.version += 1;
    }
    await items.save(item);
    const delta = targetOnHand - previousOnHand;
    if (delta !== 0) {
      if (!reasonCode?.trim())
        throw new Error('A stock-change reason is required');
      await manager.getRepository(InventoryAdjustment).save({
        inventoryItemId: item.id,
        variantId,
        delta,
        resultingOnHand: targetOnHand,
        reasonCode: reasonCode.trim(),
        note: note?.trim() || null,
        actorUserId,
      });
    }
    await this.audit.record(
      {
        actorUserId,
        action: CommerceAuditAction.INVENTORY_CONFIGURED,
        targetType: 'variant',
        targetId: variantId,
        requestId,
        metadata: {
          trackingMode,
          onHand: targetOnHand,
          delta,
          reasonCode: reasonCode?.trim() ?? null,
        },
      },
      transaction,
    );
    return this.toView(item);
  }

  async adjust(
    variantId: string,
    delta: number,
    reasonCode: string,
    actorUserId: string,
    note?: string,
    requestId: string | null = null,
  ) {
    if (!Number.isSafeInteger(delta) || delta === 0)
      throw new Error('Adjustment delta is invalid');
    return this.transactions.run(async (transaction) => {
      const manager = unwrapTypeOrmTransaction(transaction);
      const item = await this.lockItem(manager, variantId);
      if (item.trackingMode !== InventoryTrackingMode.TRACKED)
        throw new Error('Untracked Variant cannot be adjusted');
      const next = item.onHand + delta;
      if (next < item.reservedQuantity)
        throw new Error('Adjustment would consume reserved stock');
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
      const view = this.toView(item);
      await this.audit.record(
        {
          actorUserId,
          action: CommerceAuditAction.INVENTORY_ADJUSTED,
          targetType: 'variant',
          targetId: variantId,
          requestId,
          metadata: { delta, reasonCode, resultingOnHand: next },
        },
        transaction,
      );
      return view;
    });
  }

  async reserve(
    lines: readonly { variantId: string; quantity: number }[],
    correlationKey: string,
    holdMinutes: number,
    transaction?: DatabaseTransactionContext,
  ): Promise<readonly InventoryReservationReference[]> {
    const normalized = this.normalizeLines(lines);
    return this.inTransaction(transaction, async (manager) => {
      const existing = await manager.getRepository(InventoryReservation).find({
        where: { correlationKey },
      });
      if (existing.length)
        return existing.map((reservation) =>
          this.toReservationReference(reservation),
        );
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

  async commit(
    reservationIds: readonly string[],
    orderId: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<void> {
    await this.inTransaction(transaction, async (manager) => {
      const reservations = await manager
        .getRepository(InventoryReservation)
        .find({
          where: { id: In([...new Set(reservationIds)]) },
          lock: { mode: 'pessimistic_write' },
        });
      if (reservations.length !== new Set(reservationIds).size)
        throw new Error('Reservation was not found');
      for (const reservation of reservations.sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      )) {
        const item = await this.lockItem(manager, reservation.variantId);
        await this.expireStale(manager, item);
        if (
          reservation.status !== InventoryReservationStatus.ACTIVE ||
          reservation.expiresAt <= new Date()
        )
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

  async release(
    reservationIds: readonly string[],
    reason: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<void> {
    await this.inTransaction(transaction, async (manager) => {
      const reservations = await manager
        .getRepository(InventoryReservation)
        .find({
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

  async expireReservationBatch(batchSize: number): Promise<number> {
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1_000)
      throw new Error('Reservation expiry batch size is invalid');
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<{ count: number }[]>(
        `
          WITH claimed AS (
            SELECT id
            FROM inventory_reservations
            WHERE status = $1
              AND expires_at <= NOW()
            ORDER BY expires_at ASC, id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $2
          ),
          expired AS (
            UPDATE inventory_reservations reservation
            SET status = $3,
                terminal_at = NOW(),
                terminal_reason = 'expired'
            FROM claimed
            WHERE reservation.id = claimed.id
              AND reservation.status = $1
            RETURNING reservation.inventory_item_id, reservation.quantity
          ),
          totals AS (
            SELECT inventory_item_id, SUM(quantity)::integer AS quantity
            FROM expired
            GROUP BY inventory_item_id
          ),
          updated_items AS (
            UPDATE inventory_items item
            SET reserved_quantity = item.reserved_quantity - totals.quantity,
                version = item.version + 1
            FROM totals
            WHERE item.id = totals.inventory_item_id
            RETURNING item.id
          )
          SELECT COUNT(*)::integer AS count
          FROM expired
        `,
        [
          InventoryReservationStatus.ACTIVE,
          batchSize,
          InventoryReservationStatus.EXPIRED,
        ],
      );
      return rows[0]?.count ?? 0;
    });
  }

  private async lockItem(manager: EntityManager, variantId: string) {
    const item = await manager.getRepository(InventoryItem).findOne({
      where: { variantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!item)
      throw new Error(`Inventory is not configured for Variant ${variantId}`);
    return item;
  }

  private inTransaction<T>(
    transaction: DatabaseTransactionContext | undefined,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return transaction
      ? work(unwrapTypeOrmTransaction(transaction))
      : this.dataSource.transaction(work);
  }

  private async expireStale(
    manager: EntityManager,
    item: InventoryItem,
  ): Promise<void> {
    const stale = await manager.getRepository(InventoryReservation).find({
      where: {
        inventoryItemId: item.id,
        status: InventoryReservationStatus.ACTIVE,
      },
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

  private normalizeLines(
    lines: readonly { variantId: string; quantity: number }[],
  ) {
    const quantities = new Map<string, number>();
    for (const line of lines) {
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1)
        throw new Error('Reservation quantity is invalid');
      quantities.set(
        line.variantId,
        (quantities.get(line.variantId) ?? 0) + line.quantity,
      );
    }
    return [...quantities]
      .map(([variantId, quantity]) => ({ variantId, quantity }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId));
  }

  private toReservationReference(
    reservation: InventoryReservation,
  ): InventoryReservationReference {
    return {
      id: reservation.id,
      variantId: reservation.variantId,
      quantity: reservation.quantity,
      expiresAt: reservation.expiresAt,
    };
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
