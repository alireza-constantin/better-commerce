import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import type { ApplicationConfiguration } from '../../platform/config';
import {
  DatabaseTransactionRunner,
  type DatabaseTransactionContext,
} from '../../platform/database';
import {
  CATALOG_MODULE_CONTRACT,
  type CatalogModuleContract,
} from '../catalog';
import {
  COMMERCE_AUDIT_CONTRACT,
  CommerceAuditAction,
  type CommerceAuditContract,
} from '../commerce-audit';
import {
  INVENTORY_MODULE_CONTRACT,
  type InventoryModuleContract,
} from '../inventory';
import {
  ManualPaymentMethod,
  ManualPaymentStatus,
  PAYMENTS_MODULE_CONTRACT,
  type ManualPaymentView,
  type PaymentsModuleContract,
} from '../payments';
import {
  formatMoney,
  PRICING_MODULE_CONTRACT,
  type PricingModuleContract,
} from '../pricing';
import {
  SHIPPING_MODULE_CONTRACT,
  type ShippingModuleContract,
} from '../shipping';
import { CommerceOrderLine } from './commerce-order-line.entity';
import { CommerceOrder, CommerceOrderStatus } from './commerce-order.entity';
import type {
  OrderListView,
  OrderView,
  SubmitOrderInput,
} from './orders.types';
import { OrdersPersistence } from './persistence/orders.persistence';

@Injectable()
export class OrdersService {
  private readonly holdMinutes: number;

  constructor(
    private readonly transactions: DatabaseTransactionRunner,
    private readonly persistence: OrdersPersistence,
    config: ConfigService<ApplicationConfiguration, true>,
    @Inject(CATALOG_MODULE_CONTRACT)
    private readonly catalog: CatalogModuleContract,
    @Inject(PRICING_MODULE_CONTRACT)
    private readonly pricing: PricingModuleContract,
    @Inject(INVENTORY_MODULE_CONTRACT)
    private readonly inventory: InventoryModuleContract,
    @Inject(SHIPPING_MODULE_CONTRACT)
    private readonly shipping: ShippingModuleContract,
    @Inject(PAYMENTS_MODULE_CONTRACT)
    private readonly payments: PaymentsModuleContract,
    @Inject(COMMERCE_AUDIT_CONTRACT)
    private readonly audit: CommerceAuditContract,
  ) {
    this.holdMinutes =
      config.getOrThrow<ApplicationConfiguration['commerce']>(
        'commerce',
      ).manualReviewHoldMinutes;
  }

  async submit(
    userId: string,
    idempotencyKey: string,
    input: SubmitOrderInput,
    requestId: string | null = null,
  ): Promise<OrderView> {
    const normalized = this.normalizeInput(input);
    const fingerprint = this.fingerprint(normalized);
    const existing = await this.findByIdempotency(userId, idempotencyKey);
    if (existing) return this.assertReplay(existing, fingerprint);

    const variantIds = normalized.lines.map((line) => line.variantId);
    const [resolutions, snapshotFacts] = await Promise.all([
      this.catalog.resolvePurchasableVariants(variantIds),
      this.catalog.getVariantSnapshotFacts(variantIds),
    ]);
    if (
      resolutions.length !== variantIds.length ||
      resolutions.some((variant) => !variant.eligible)
    )
      throw new Error('One or more Variants are not purchasable');
    const facts = new Map(snapshotFacts.map((fact) => [fact.variantId, fact]));

    try {
      return await this.transactions.run(async (transaction) => {
        const replay = await this.persistence.findByIdempotency(
          userId,
          idempotencyKey,
          transaction,
        );
        if (replay) return this.assertReplay(replay, fingerprint, transaction);

        const quotes = await this.pricing.quoteVariantPrices(
          variantIds,
          transaction,
        );
        const quoteByVariant = new Map(
          quotes.map((quote) => [quote.variantId, quote]),
        );
        const currency = quotes[0]?.unitPrice.currency;
        if (
          !currency ||
          quotes.some((quote) => quote.unitPrice.currency !== currency)
        )
          throw new Error('Order lines must use one currency');

        let merchandiseSubtotal = 0n;
        const orderId = randomUUID();
        const lineRows = normalized.lines.map((line) => {
          const fact = facts.get(line.variantId);
          const quote = quoteByVariant.get(line.variantId);
          if (!fact || !quote)
            throw new Error('Variant snapshot is unavailable');
          const lineMinor = quote.unitPrice.minorAmount * BigInt(line.quantity);
          merchandiseSubtotal += lineMinor;
          return {
            orderId,
            productId: fact.productId,
            variantId: fact.variantId,
            productTitle: fact.productTitle,
            variantTitle: fact.variantTitle,
            sku: fact.sku,
            fulfillmentClassification: fact.fulfillmentClassification,
            quantity: line.quantity,
            priceVersionId: quote.priceVersionId,
            unitMinor: quote.unitPrice.minorAmount.toString(),
            lineMinor: lineMinor.toString(),
            currency,
          };
        });
        const shippingQuotes = await this.shipping.quote(
          normalized.deliveryAddress,
          { minorAmount: merchandiseSubtotal, currency },
          transaction,
        );
        const shippingQuote = shippingQuotes.find(
          (quote) => quote.methodId === normalized.shippingMethodId,
        );
        if (!shippingQuote) throw new Error('Shipping method is unavailable');

        const reservations = await this.inventory.reserve(
          normalized.lines,
          `${userId}:${idempotencyKey}`,
          this.holdMinutes,
          transaction,
        );
        const grandTotal =
          merchandiseSubtotal + shippingQuote.charge.minorAmount;
        const address = normalized.deliveryAddress;
        const order = await this.persistence.createOrder(
          {
            id: orderId,
            userId,
            status: CommerceOrderStatus.SUBMITTED,
            currency,
            merchandiseSubtotalMinor: merchandiseSubtotal.toString(),
            shippingMinor: shippingQuote.charge.minorAmount.toString(),
            grandTotalMinor: grandTotal.toString(),
            idempotencyKey,
            requestFingerprint: fingerprint,
            paymentMethod: normalized.paymentMethod,
            reservationIds: reservations.map(({ id }) => id),
            shippingZoneId: shippingQuote.zoneId,
            shippingMethodId: shippingQuote.methodId,
            shippingRuleId: shippingQuote.ruleId,
            shippingMethodTitle: shippingQuote.methodTitle,
            recipientName: address.recipientName,
            phone: address.phone,
            country: address.country,
            province: address.province ?? null,
            city: address.city,
            line1: address.line1,
            line2: address.line2 ?? null,
            postalCode: address.postalCode,
            submittedAt: new Date(),
            acceptedAt: null,
            cancelledAt: null,
            completedAt: null,
            decisionActorUserId: null,
            decisionNote: null,
          },
          lineRows,
          transaction,
        );
        await this.payments.createManualPayment(
          {
            orderId,
            method: normalized.paymentMethod,
            expectedAmount: { minorAmount: grandTotal, currency },
          },
          transaction,
        );
        await this.audit.record(
          {
            actorUserId: userId,
            action: CommerceAuditAction.ORDER_SUBMITTED,
            targetType: 'order',
            targetId: order.id,
            requestId,
            metadata: {
              orderNumber: order.orderNumber,
              paymentMethod: order.paymentMethod,
              grandTotal: formatMoney({
                minorAmount: grandTotal,
                currency,
              }).amount,
              currency,
            },
          },
          transaction,
        );
        return this.toView(
          order,
          lineRows,
          this.initialPaymentStatus(order.paymentMethod),
        );
      });
    } catch (error) {
      const driverError =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string })
          : undefined;
      if (driverError?.code === '23505') {
        const replay = await this.findByIdempotency(userId, idempotencyKey);
        if (replay) return this.assertReplay(replay, fingerprint);
      }
      throw error;
    }
  }

  async listForCustomer(
    userId: string,
    input: { cursor?: string; limit?: number } = {},
  ): Promise<OrderListView> {
    const limit = this.pageLimit(input.limit);
    const rows = await this.persistence.listForCustomer(
      userId,
      this.decodeCursor(input.cursor),
      limit,
    );
    return this.orderPage(rows, limit);
  }

  async getForCustomer(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.persistence.findForCustomer(userId, orderId);
    if (!order) throw new Error('Order was not found');
    return this.hydrate(order);
  }

  async listForAdmin(
    input: { cursor?: string; limit?: number } = {},
  ): Promise<OrderListView> {
    const limit = this.pageLimit(input.limit);
    const rows = await this.persistence.listForAdmin(
      this.decodeCursor(input.cursor),
      limit,
    );
    return this.orderPage(rows, limit);
  }

  async getForAdmin(orderId: string): Promise<OrderView> {
    const order = await this.persistence.findForAdmin(orderId);
    if (!order) throw new Error('Order was not found');
    return this.hydrate(order);
  }

  confirmManualPayment(
    orderId: string,
    actorUserId: string,
    reference?: string,
    note?: string,
    requestId: string | null = null,
  ): Promise<ManualPaymentView> {
    return this.transactions.run(async (transaction) => {
      const order = await this.persistence.lockForDecision(
        orderId,
        transaction,
      );
      if (!order) throw new Error('Order was not found');

      const payment = await this.payments.getForOrder(orderId, transaction);
      if (!payment) throw new Error('Order payment was not found');

      if (payment.status !== ManualPaymentStatus.CONFIRMED) {
        if (
          payment.method === ManualPaymentMethod.BANK_TRANSFER &&
          order.status !== CommerceOrderStatus.SUBMITTED
        ) {
          throw new Error(
            'Bank transfer payment can only be confirmed before order acceptance',
          );
        }

        if (
          payment.method !== ManualPaymentMethod.BANK_TRANSFER &&
          order.status !== CommerceOrderStatus.ACCEPTED
        ) {
          throw new Error(
            'Cash collection can only be confirmed after order acceptance',
          );
        }
      }

      return this.payments.confirmManualPayment(
        orderId,
        actorUserId,
        reference,
        note,
        transaction,
        requestId,
      );
    });
  }

  accept(
    orderId: string,
    actorUserId: string,
    note?: string,
    requestId: string | null = null,
  ): Promise<OrderView> {
    return this.decide(orderId, actorUserId, true, note, requestId);
  }

  reject(
    orderId: string,
    actorUserId: string,
    note?: string,
    requestId: string | null = null,
  ): Promise<OrderView> {
    return this.decide(orderId, actorUserId, false, note, requestId);
  }

  private async decide(
    orderId: string,
    actorUserId: string,
    accepted: boolean,
    note?: string,
    requestId: string | null = null,
  ): Promise<OrderView> {
    return this.transactions.run(async (transaction) => {
      const order = await this.persistence.lockForDecision(
        orderId,
        transaction,
      );
      if (!order) throw new Error('Order was not found');
      if (order.status !== CommerceOrderStatus.SUBMITTED)
        throw new Error('Order has already been decided');
      const payment = await this.payments.getForOrder(orderId, transaction);
      if (!payment) throw new Error('Order payment was not found');
      const previousStatus = order.status;

      if (accepted) {
        if (
          order.paymentMethod === ManualPaymentMethod.BANK_TRANSFER &&
          payment.status !== ManualPaymentStatus.CONFIRMED
        )
          throw new Error('Bank transfer must be confirmed before acceptance');
        await this.inventory.commit(
          order.reservationIds,
          order.id,
          transaction,
        );
        order.status = CommerceOrderStatus.ACCEPTED;
        order.acceptedAt = new Date();
      } else {
        await this.inventory.release(
          order.reservationIds,
          'order_rejected',
          transaction,
        );
        await this.payments.cancelManualPayment(
          order.id,
          'order_rejected',
          transaction,
        );
        order.status = CommerceOrderStatus.CANCELLED;
        order.cancelledAt = new Date();
      }
      order.decisionActorUserId = actorUserId;
      order.decisionNote = note?.trim() || null;
      await this.persistence.save(order, transaction);
      await this.audit.record(
        {
          actorUserId,
          action: accepted
            ? CommerceAuditAction.ORDER_ACCEPTED
            : CommerceAuditAction.ORDER_REJECTED,
          targetType: 'order',
          targetId: order.id,
          requestId,
          metadata: { previousStatus },
        },
        transaction,
      );
      return this.hydrate(order, transaction);
    });
  }

  private async orderPage(
    rows: readonly CommerceOrder[],
    limit: number,
  ): Promise<OrderListView> {
    const page = rows.slice(0, limit);
    const items = await Promise.all(page.map((order) => this.hydrate(order)));
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                submittedAt: last.submittedAt.toISOString(),
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }

  private pageLimit(limit?: number): number {
    if (limit === undefined) return 25;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new Error('Order page limit is invalid');
    return limit;
  }

  private decodeCursor(
    value?: string,
  ): { submittedAt: string; id: string } | undefined {
    if (!value) return undefined;
    if (value.length > 512) throw new Error('Order cursor is invalid');
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      );
      const cursor = parsed as { submittedAt?: unknown; id?: unknown };
      if (
        !cursor ||
        typeof cursor !== 'object' ||
        typeof cursor.submittedAt !== 'string' ||
        Number.isNaN(Date.parse(cursor.submittedAt)) ||
        typeof cursor.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          cursor.id,
        )
      )
        throw new Error('invalid cursor');
      return { submittedAt: cursor.submittedAt, id: cursor.id };
    } catch {
      throw new Error('Order cursor is invalid');
    }
  }

  private async hydrate(
    order: CommerceOrder,
    transaction?: DatabaseTransactionContext,
  ): Promise<OrderView> {
    const [lines, payment] = await Promise.all([
      this.persistence.listLines(order.id, transaction),
      this.payments.getForOrder(order.id, transaction),
    ]);
    if (!payment) throw new Error('Order payment was not found');
    return this.toView(order, lines, payment.status);
  }

  private async findByIdempotency(userId: string, idempotencyKey: string) {
    return this.persistence.findByIdempotency(userId, idempotencyKey);
  }

  private assertReplay(
    order: CommerceOrder,
    fingerprint: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<OrderView> {
    if (order.requestFingerprint !== fingerprint)
      throw new Error('Idempotency key was already used for another request');
    return this.hydrate(order, transaction);
  }

  private normalizeInput(input: SubmitOrderInput): SubmitOrderInput {
    if (!input.lines.length || input.lines.length > 100)
      throw new Error('Order must contain between 1 and 100 lines');
    const quantities = new Map<string, number>();
    for (const line of input.lines) {
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1)
        throw new Error('Order quantity is invalid');
      quantities.set(
        line.variantId,
        (quantities.get(line.variantId) ?? 0) + line.quantity,
      );
    }
    return {
      lines: [...quantities]
        .map(([variantId, quantity]) => ({ variantId, quantity }))
        .sort((a, b) => a.variantId.localeCompare(b.variantId)),
      shippingMethodId: input.shippingMethodId,
      paymentMethod: input.paymentMethod,
      deliveryAddress: {
        ...input.deliveryAddress,
        country: input.deliveryAddress.country.toUpperCase(),
      },
    };
  }

  private fingerprint(input: SubmitOrderInput): string {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }

  private initialPaymentStatus(
    method: ManualPaymentMethod,
  ): ManualPaymentStatus {
    return method === ManualPaymentMethod.BANK_TRANSFER
      ? ManualPaymentStatus.PENDING_MANUAL_REVIEW
      : ManualPaymentStatus.PENDING_COLLECTION;
  }

  private toView(
    order: CommerceOrder,
    lines: readonly (
      | CommerceOrderLine
      | {
          productId: string;
          variantId: string;
          productTitle: string;
          variantTitle: string | null;
          sku: string | null;
          fulfillmentClassification: CommerceOrderLine['fulfillmentClassification'];
          quantity: number;
          priceVersionId: string;
          unitMinor: string;
          lineMinor: string;
          currency: string;
        }
    )[],
    paymentStatus: ManualPaymentStatus,
  ): OrderView {
    const money = (minorAmount: string) =>
      formatMoney({
        minorAmount: BigInt(minorAmount),
        currency: order.currency,
      }).amount;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      merchandiseSubtotal: money(order.merchandiseSubtotalMinor),
      shippingAmount: money(order.shippingMinor),
      grandTotal: money(order.grandTotalMinor),
      paymentMethod: order.paymentMethod,
      paymentStatus,
      shippingMethodTitle: order.shippingMethodTitle,
      deliveryAddress: {
        recipientName: order.recipientName,
        phone: order.phone,
        country: order.country,
        province: order.province,
        city: order.city,
        line1: order.line1,
        line2: order.line2,
        postalCode: order.postalCode,
      },
      submittedAt: order.submittedAt,
      acceptedAt: order.acceptedAt,
      cancelledAt: order.cancelledAt,
      lines: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sku: line.sku,
        fulfillmentClassification: line.fulfillmentClassification,
        quantity: line.quantity,
        priceVersionId: line.priceVersionId,
        unitAmount: money(line.unitMinor),
        lineAmount: money(line.lineMinor),
      })),
    };
  }
}
