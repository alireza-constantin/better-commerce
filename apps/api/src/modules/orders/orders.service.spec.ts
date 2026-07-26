import { createHash } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import type { DatabaseTransactionContext } from '../../platform/database';
import { CommerceOrderStatus } from './commerce-order.entity';
import { OrdersService } from './orders.service';
import { ManualPaymentMethod, ManualPaymentStatus } from '../payments';
import type { SubmitOrderInput } from './orders.types';

const transaction = Object.freeze({
  transaction: true,
}) as unknown as DatabaseTransactionContext;
const userId = '00000000-0000-4000-8000-000000000001';
const orderId = '00000000-0000-4000-8000-000000000002';
const variantId = '00000000-0000-4000-8000-000000000003';
const productId = '00000000-0000-4000-8000-000000000004';
const priceVersionId = '00000000-0000-4000-8000-000000000005';
const shippingMethodId = '00000000-0000-4000-8000-000000000006';

const input: SubmitOrderInput = {
  lines: [{ variantId, quantity: 2 }],
  shippingMethodId,
  paymentMethod: ManualPaymentMethod.CASH_ON_DELIVERY,
  deliveryAddress: {
    recipientName: 'Test Customer',
    phone: '+10000000000',
    country: 'us',
    province: 'CA',
    city: 'Test City',
    line1: '1 Test Street',
    postalCode: '90001',
  },
};

function orderRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    orderNumber: '1001',
    userId,
    status: CommerceOrderStatus.SUBMITTED,
    currency: 'USD',
    merchandiseSubtotalMinor: '2000',
    shippingMinor: '100',
    grandTotalMinor: '2100',
    idempotencyKey: 'checkout-1',
    requestFingerprint: '',
    paymentMethod: ManualPaymentMethod.CASH_ON_DELIVERY,
    reservationIds: ['reservation-1'],
    shippingZoneId: '00000000-0000-4000-8000-000000000007',
    shippingMethodId,
    shippingRuleId: '00000000-0000-4000-8000-000000000008',
    shippingMethodTitle: 'Standard',
    recipientName: input.deliveryAddress.recipientName,
    phone: input.deliveryAddress.phone,
    country: 'US',
    province: input.deliveryAddress.province ?? null,
    city: input.deliveryAddress.city,
    line1: input.deliveryAddress.line1,
    line2: null,
    postalCode: input.deliveryAddress.postalCode,
    submittedAt: new Date('2026-07-25T00:00:00Z'),
    acceptedAt: null,
    cancelledAt: null,
    completedAt: null,
    decisionActorUserId: null,
    decisionNote: null,
    ...overrides,
  };
}

function lineRecord() {
  return {
    productId,
    variantId,
    productTitle: 'Test Product',
    variantTitle: 'Default',
    sku: 'TEST-1',
    fulfillmentClassification: 'physical' as const,
    quantity: 2,
    priceVersionId,
    unitMinor: '1000',
    lineMinor: '2000',
    currency: 'USD',
  };
}

function createSubject() {
  const persistence = {
    findByIdempotency: jest.fn().mockResolvedValue(null),
    createOrder: jest
      .fn()
      .mockImplementation((order: Record<string, unknown>) =>
        Promise.resolve({ ...order, orderNumber: '1001' }),
      ),
    listForCustomer: jest.fn(),
    findForCustomer: jest.fn(),
    listForAdmin: jest.fn(),
    findForAdmin: jest.fn(),
    lockForDecision: jest.fn(),
    save: jest
      .fn()
      .mockImplementation((order: Record<string, unknown>) =>
        Promise.resolve(order),
      ),
    listLines: jest.fn().mockResolvedValue([lineRecord()]),
  };
  const catalog = {
    resolvePurchasableVariants: jest.fn().mockResolvedValue([
      {
        productId,
        variantId,
        eligible: true,
        title: 'Test Product',
        sku: 'TEST-1',
        fulfillmentClassification: 'physical',
      },
    ]),
    getVariantSnapshotFacts: jest.fn().mockResolvedValue([
      {
        productId,
        variantId,
        productTitle: 'Test Product',
        variantTitle: 'Default',
        sku: 'TEST-1',
        productStatus: 'published',
        variantStatus: 'active',
        fulfillmentClassification: 'physical',
      },
    ]),
  };
  const pricing = {
    quoteVariantPrices: jest.fn().mockResolvedValue([
      {
        variantId,
        priceVersionId,
        unitPrice: { minorAmount: 1000n, currency: 'USD' },
      },
    ]),
  };
  const inventory = {
    reserve: jest.fn().mockResolvedValue([
      {
        id: 'reservation-1',
        variantId,
        quantity: 2,
        expiresAt: new Date('2026-07-25T12:00:00Z'),
      },
    ]),
    commit: jest.fn(),
    release: jest.fn(),
  };
  const shipping = {
    quote: jest.fn().mockResolvedValue([
      {
        zoneId: '00000000-0000-4000-8000-000000000007',
        methodId: shippingMethodId,
        methodTitle: 'Standard',
        ruleId: '00000000-0000-4000-8000-000000000008',
        charge: { minorAmount: 100n, currency: 'USD' },
      },
    ]),
  };
  const payments = {
    createManualPayment: jest.fn().mockResolvedValue({}),
    getForOrder: jest.fn().mockResolvedValue({
      id: 'payment-1',
      orderId,
      method: ManualPaymentMethod.CASH_ON_DELIVERY,
      status: ManualPaymentStatus.PENDING_COLLECTION,
      expectedAmount: { minorAmount: 2100n, currency: 'USD' },
    }),
    confirmManualPayment: jest.fn(),
    rejectManualPayment: jest.fn(),
    cancelManualPayment: jest.fn().mockResolvedValue({}),
  };
  const transactions = {
    run: jest.fn(
      (work: (context: DatabaseTransactionContext) => Promise<unknown>) =>
        work(transaction),
    ),
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue({
      currency: 'USD',
      manualReviewHoldMinutes: 720,
    }),
  };
  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OrdersService(
    transactions as never,
    persistence as never,
    config as never,
    catalog,
    pricing,
    inventory,
    shipping,
    payments,
    audit,
  );
  return {
    service,
    persistence,
    catalog,
    pricing,
    inventory,
    shipping,
    payments,
    transactions,
    audit,
  };
}

describe('OrdersService', () => {
  it('submits exact snapshots, reservation, and payment in one transaction', async () => {
    const subject = createSubject();

    const result = await subject.service.submit(userId, 'checkout-1', input);

    expect(result.merchandiseSubtotal).toBe('20.00');
    expect(result.shippingAmount).toBe('1.00');
    expect(result.grandTotal).toBe('21.00');
    expect(subject.pricing.quoteVariantPrices).toHaveBeenCalledWith(
      [variantId],
      transaction,
    );
    expect(subject.shipping.quote).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'US' }),
      { minorAmount: 2000n, currency: 'USD' },
      transaction,
    );
    expect(subject.inventory.reserve).toHaveBeenCalledWith(
      [{ variantId, quantity: 2 }],
      `${userId}:checkout-1`,
      720,
      transaction,
    );
    expect(subject.payments.createManualPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        method: ManualPaymentMethod.CASH_ON_DELIVERY,
        expectedAmount: { minorAmount: 2100n, currency: 'USD' },
      }),
      transaction,
    );
    expect(subject.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'orders.submitted',
        targetType: 'order',
      }),
      transaction,
    );
  });

  it('returns an identical idempotent replay without repeating checkout effects', async () => {
    const subject = createSubject();
    const normalized = {
      ...input,
      deliveryAddress: { ...input.deliveryAddress, country: 'US' },
    };
    const requestFingerprint = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    subject.persistence.findByIdempotency.mockResolvedValueOnce(
      orderRecord({ requestFingerprint }),
    );

    const result = await subject.service.submit(userId, 'checkout-1', input);

    expect(result.id).toBe(orderId);
    expect(subject.transactions.run).not.toHaveBeenCalled();
    expect(subject.inventory.reserve).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key for a different request', async () => {
    const subject = createSubject();
    subject.persistence.findByIdempotency.mockResolvedValueOnce(
      orderRecord({ requestFingerprint: 'different' }),
    );

    await expect(
      subject.service.submit(userId, 'checkout-1', input),
    ).rejects.toThrow('Idempotency key was already used');
    expect(subject.transactions.run).not.toHaveBeenCalled();
  });

  it('resolves a concurrent unique-key race to the winning idempotent order', async () => {
    const subject = createSubject();
    const normalized = {
      ...input,
      deliveryAddress: { ...input.deliveryAddress, country: 'US' },
    };
    const requestFingerprint = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    subject.transactions.run.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' }),
    );
    subject.persistence.findByIdempotency
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(orderRecord({ requestFingerprint }));

    const result = await subject.service.submit(userId, 'checkout-1', input);

    expect(result.id).toBe(orderId);
    expect(subject.persistence.findByIdempotency).toHaveBeenCalledTimes(2);
  });

  it('requires confirmed bank transfer before accepting an order', async () => {
    const subject = createSubject();
    subject.persistence.lockForDecision.mockResolvedValue(
      orderRecord({ paymentMethod: ManualPaymentMethod.BANK_TRANSFER }),
    );
    subject.payments.getForOrder.mockResolvedValue({
      id: 'payment-1',
      orderId,
      method: ManualPaymentMethod.BANK_TRANSFER,
      status: ManualPaymentStatus.PENDING_MANUAL_REVIEW,
      expectedAmount: { minorAmount: 2100n, currency: 'USD' },
    });

    await expect(subject.service.accept(orderId, userId)).rejects.toThrow(
      'Bank transfer must be confirmed',
    );
    expect(subject.inventory.commit).not.toHaveBeenCalled();
  });

  it('commits reservations when an eligible manual-payment order is accepted', async () => {
    const subject = createSubject();
    const order = orderRecord();
    subject.persistence.lockForDecision.mockResolvedValue(order);

    const result = await subject.service.accept(orderId, userId, 'approved');

    expect(subject.inventory.commit).toHaveBeenCalledWith(
      ['reservation-1'],
      orderId,
      transaction,
    );
    expect(subject.persistence.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CommerceOrderStatus.ACCEPTED,
        decisionActorUserId: userId,
        decisionNote: 'approved',
      }),
      transaction,
    );
    expect(result.status).toBe(CommerceOrderStatus.ACCEPTED);
  });

  it('releases reservations and cancels payment when an order is rejected', async () => {
    const subject = createSubject();
    subject.persistence.lockForDecision.mockResolvedValue(orderRecord());

    const result = await subject.service.reject(orderId, userId, 'declined');

    expect(subject.inventory.release).toHaveBeenCalledWith(
      ['reservation-1'],
      'order_rejected',
      transaction,
    );
    expect(subject.payments.cancelManualPayment).toHaveBeenCalledWith(
      orderId,
      'order_rejected',
      transaction,
    );
    expect(result.status).toBe(CommerceOrderStatus.CANCELLED);
  });
});
