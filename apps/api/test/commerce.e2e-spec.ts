import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request, { type SuperAgentTest } from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, IsNull } from 'typeorm';
import { OwnerBootstrapService } from '../src/modules/authorization/bootstrap/owner-bootstrap.service';
import { CommerceAuditAction } from '../src/modules/commerce-audit';
import { CommerceAuditEvent } from '../src/modules/commerce-audit/persistence/commerce-audit-event.entity';
import { CatalogApplicationService } from '../src/modules/catalog/application/catalog-application.service';
import { InventoryItem } from '../src/modules/inventory/inventory-item.entity';
import { InventoryTrackingMode } from '../src/modules/inventory/inventory-item.entity';
import {
  InventoryReservation,
  InventoryReservationStatus,
} from '../src/modules/inventory/inventory-reservation.entity';
import { InventoryService } from '../src/modules/inventory/persistence/inventory.service';
import { CommerceOrderStatus } from '../src/modules/orders/commerce-order.entity';
import { OrdersService } from '../src/modules/orders/orders.service';
import {
  ManualPaymentMethod,
  ManualPaymentStatus,
} from '../src/modules/payments';
import { PaymentsService } from '../src/modules/payments/persistence/payments.service';
import { PricingService } from '../src/modules/pricing/persistence/pricing.service';
import { ShippingService } from '../src/modules/shipping/persistence/shipping.service';
import { Cart, CartService, CartStatus } from '../src/modules/cart';
import {
  clearFullStackTestData,
  createFullApplication,
} from './full-app.helper';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct horse battery staple';

describe('Commerce transaction integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let catalog: CatalogApplicationService;
  let pricing: PricingService;
  let inventory: InventoryService;
  let shipping: ShippingService;
  let payments: PaymentsService;
  let orders: OrdersService;
  let ownerBootstrap: OwnerBootstrapService;
  let carts: CartService;
  let server: App;

  beforeAll(async () => {
    app = await createFullApplication();
    dataSource = app.get(DataSource);
    catalog = app.get(CatalogApplicationService);
    pricing = app.get(PricingService);
    inventory = app.get(InventoryService);
    shipping = app.get(ShippingService);
    payments = app.get(PaymentsService);
    orders = app.get(OrdersService);
    ownerBootstrap = app.get(OwnerBootstrapService);
    carts = app.get(CartService);
    server = app.getHttpServer() as App;
  });

  beforeEach(async () => {
    await dataSource.query(`
      TRUNCATE TABLE
        cart_claims,
        cart_lines,
        carts,
        commerce_audit_events,
        manual_payment_history,
        manual_payments,
        commerce_order_lines,
        commerce_orders,
        inventory_reservations,
        inventory_adjustments,
        inventory_items,
        shipping_rate_rules,
        shipping_methods,
        shipping_zones,
        price_versions,
        catalog_variant_selections,
        catalog_option_values,
        catalog_product_options,
        catalog_variants,
        catalog_product_slugs,
        catalog_products
      RESTART IDENTITY CASCADE
    `);
    await clearFullStackTestData(app);
  });

  afterAll(async () => app.close());

  async function fixture(
    paymentMethod = ManualPaymentMethod.CASH_ON_DELIVERY,
    customerUserId = randomUUID(),
    actorUserId = randomUUID(),
  ) {
    const product = await catalog.createProduct({
      title: 'Integration Product',
      slug: `integration-${randomUUID()}`,
      defaultVariantTitle: 'Default',
      defaultVariantSku: `SKU-${randomUUID()}`,
      fulfillmentClassification: 'physical',
    });
    await catalog.publish(product.productId, product.version);
    await pricing.setCurrentPrice(product.variantId, '10.00', actorUserId);
    await inventory.configure(
      product.variantId,
      InventoryTrackingMode.TRACKED,
      10,
      actorUserId,
    );
    const zone = await shipping.createZone({
      name: 'United States',
      country: 'US',
    });
    const method = await shipping.createMethod(zone.id, {
      title: 'Standard',
    });
    await shipping.createRule(method.id, {
      minimumSubtotal: '0.00',
      amount: '1.00',
      currency: 'USD',
    });
    return {
      actorUserId,
      customerUserId,
      variantId: product.variantId,
      methodId: method.id,
      paymentMethod,
    };
  }

  function submission(fixture: Awaited<ReturnType<typeof CommerceFixture>>) {
    return {
      lines: [{ variantId: fixture.variantId, quantity: 2 }],
      shippingMethodId: fixture.methodId,
      paymentMethod: fixture.paymentMethod,
      deliveryAddress: {
        recipientName: 'Integration Customer',
        phone: '+10000000000',
        country: 'US',
        province: 'CA',
        city: 'Test City',
        line1: '1 Test Street',
        postalCode: '90001',
      },
    };
  }

  async function CommerceFixture(
    paymentMethod = ManualPaymentMethod.CASH_ON_DELIVERY,
    customerUserId?: string,
    actorUserId?: string,
  ) {
    return fixture(paymentMethod, customerUserId, actorUserId);
  }

  async function csrf(agent: SuperAgentTest): Promise<string> {
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    return (response.body as { csrfToken: string }).csrfToken;
  }

  async function register(agent: SuperAgentTest, email: string) {
    const token = await csrf(agent);
    return agent
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', token)
      .send({ email, password: PASSWORD })
      .expect(201);
  }

  async function login(agent: SuperAgentTest, email: string) {
    const token = await csrf(agent);
    return agent
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', token)
      .send({ email, password: PASSWORD })
      .expect(200);
  }

  it('atomically submits one exact order under concurrent idempotent retries', async () => {
    const setup = await CommerceFixture();
    const command = submission(setup);

    const results = await Promise.all([
      orders.submit(setup.customerUserId, 'concurrent-checkout', command),
      orders.submit(setup.customerUserId, 'concurrent-checkout', command),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(results[0]).toMatchObject({
      merchandiseSubtotal: '20.00',
      shippingAmount: '1.00',
      grandTotal: '21.00',
      paymentStatus: ManualPaymentStatus.PENDING_COLLECTION,
      status: CommerceOrderStatus.SUBMITTED,
    });
    await expect(
      dataSource.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM commerce_orders',
      ),
    ).resolves.toEqual([{ count: '1' }]);
    const stock = await dataSource
      .getRepository(InventoryItem)
      .findOneByOrFail({ variantId: setup.variantId });
    expect(stock).toMatchObject({ onHand: 10, reservedQuantity: 2 });
    await expect(
      dataSource.getRepository(CommerceAuditEvent).findOneByOrFail({
        action: CommerceAuditAction.ORDER_SUBMITTED,
        targetId: results[0].id,
      }),
    ).resolves.toMatchObject({
      actorUserId: setup.customerUserId,
      metadata: {
        orderNumber: results[0].orderNumber,
        paymentMethod: ManualPaymentMethod.CASH_ON_DELIVERY,
        grandTotal: '21.00',
        currency: 'USD',
      },
    });
  });

  it('submits and closes an authenticated Cart atomically with replay-safe checkout', async () => {
    const customer = request.agent(server);
    const registration = await register(customer, 'cart-checkout@example.test');
    const userId = (registration.body as unknown as { id: string }).id;
    const setup = await CommerceFixture(
      ManualPaymentMethod.CASH_ON_DELIVERY,
      userId,
    );
    const cart = await carts.setQuantity({ userId }, 0, setup.variantId, 2);
    if (!cart.id) throw new Error('Expected a persisted Cart');
    const token = await csrf(customer);
    const body = {
      cartId: cart.id,
      cartVersion: cart.version,
      shippingMethodId: setup.methodId,
      paymentMethod: setup.paymentMethod,
      deliveryAddress: submission(setup).deliveryAddress,
    };

    await customer
      .post('/api/v1/cart/checkout-preparation')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', token)
      .send({
        expectedVersion: cart.version,
        deliveryAddress: body.deliveryAddress,
      })
      .expect(200)
      .expect(({ body: responseBody }) => {
        expect(responseBody).toMatchObject({
          cartId: cart.id,
          cartVersion: cart.version,
          merchandiseSubtotal: { amount: '20.00', currency: 'USD' },
          shippingMethods: [
            {
              methodId: setup.methodId,
              methodTitle: 'Standard',
              charge: { amount: '1.00', currency: 'USD' },
            },
          ],
        });
      });

    const first = await customer
      .post('/api/v1/checkout/cart-orders')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', token)
      .set('Idempotency-Key', 'cart-checkout')
      .send(body)
      .expect(201);
    const replay = await customer
      .post('/api/v1/checkout/cart-orders')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', token)
      .set('Idempotency-Key', 'cart-checkout')
      .send(body)
      .expect(201);

    const firstOrder = first.body as unknown as { id: string };
    expect(replay.body).toMatchObject({ id: firstOrder.id });
    await expect(
      dataSource.getRepository(Cart).findOneByOrFail({ id: cart.id }),
    ).resolves.toMatchObject({ status: CartStatus.CHECKED_OUT });
    await expect(
      dataSource.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM commerce_orders WHERE user_id = $1',
        [userId],
      ),
    ).resolves.toEqual([{ count: '1' }]);
  });

  it('commits stock on acceptance and releases it on rejection', async () => {
    const setup = await CommerceFixture();
    const accepted = await orders.submit(
      setup.customerUserId,
      'accept-checkout',
      submission(setup),
    );
    await orders.accept(accepted.id, setup.actorUserId);
    let stock = await dataSource
      .getRepository(InventoryItem)
      .findOneByOrFail({ variantId: setup.variantId });
    expect(stock).toMatchObject({ onHand: 8, reservedQuantity: 0 });

    const rejected = await orders.submit(
      setup.customerUserId,
      'reject-checkout',
      {
        ...submission(setup),
        lines: [{ variantId: setup.variantId, quantity: 1 }],
      },
    );
    await orders.reject(rejected.id, setup.actorUserId);
    stock = await dataSource
      .getRepository(InventoryItem)
      .findOneByOrFail({ variantId: setup.variantId });
    expect(stock).toMatchObject({ onHand: 8, reservedQuantity: 0 });
    await expect(payments.getForOrder(rejected.id)).resolves.toMatchObject({
      status: ManualPaymentStatus.CANCELLED,
    });
    await expect(
      dataSource.getRepository(CommerceAuditEvent).find({
        where: { targetType: 'order' },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: CommerceAuditAction.ORDER_ACCEPTED,
          targetId: accepted.id,
        }),
        expect.objectContaining({
          action: CommerceAuditAction.ORDER_REJECTED,
          targetId: rejected.id,
        }),
      ]),
    );
  });

  it('requires bank-transfer confirmation before committing stock', async () => {
    const setup = await CommerceFixture(ManualPaymentMethod.BANK_TRANSFER);
    const order = await orders.submit(
      setup.customerUserId,
      'bank-checkout',
      submission(setup),
    );

    await expect(orders.accept(order.id, setup.actorUserId)).rejects.toThrow(
      'Bank transfer must be confirmed',
    );
    await payments.confirmManualPayment(
      order.id,
      setup.actorUserId,
      'safe-reference',
      undefined,
    );
    await expect(
      orders.accept(order.id, setup.actorUserId),
    ).resolves.toMatchObject({
      status: CommerceOrderStatus.ACCEPTED,
      paymentStatus: ManualPaymentStatus.CONFIRMED,
    });
    await expect(
      dataSource.getRepository(CommerceAuditEvent).findOneByOrFail({
        action: CommerceAuditAction.PAYMENT_CONFIRMED,
        targetId: order.id,
      }),
    ).resolves.toMatchObject({
      actorUserId: setup.actorUserId,
      metadata: {
        method: ManualPaymentMethod.BANK_TRANSFER,
        safeReference: 'safe-reference',
      },
    });
  });

  it('expires reservation batches and restores available stock exactly once', async () => {
    const setup = await CommerceFixture();
    const order = await orders.submit(
      setup.customerUserId,
      'expiry-checkout',
      submission(setup),
    );
    await dataSource
      .getRepository(InventoryReservation)
      .update(
        { orderId: IsNull(), status: InventoryReservationStatus.ACTIVE },
        { expiresAt: new Date(Date.now() - 60_000) },
      );

    await expect(inventory.expireReservationBatch(100)).resolves.toBe(1);
    await expect(inventory.expireReservationBatch(100)).resolves.toBe(0);
    await expect(
      dataSource.getRepository(InventoryItem).findOneByOrFail({
        variantId: setup.variantId,
      }),
    ).resolves.toMatchObject({ onHand: 10, reservedQuantity: 0 });
    await expect(orders.accept(order.id, setup.actorUserId)).rejects.toThrow(
      'Reservation is not active',
    );
  });

  it('rolls back the audit record when a shipping mutation fails', async () => {
    const setup = await CommerceFixture();
    const before = await dataSource.getRepository(CommerceAuditEvent).count();

    await expect(
      shipping.createRule(setup.methodId, {
        minimumSubtotal: '5.00',
        maximumSubtotal: '15.00',
        amount: '2.00',
        currency: 'USD',
      }),
    ).rejects.toThrow('overlaps');
    await expect(
      dataSource.getRepository(CommerceAuditEvent).count(),
    ).resolves.toBe(before);
  });

  it('serializes concurrent overlapping shipping-rate writes', async () => {
    const zone = await shipping.createZone({
      name: 'Concurrent Zone',
      country: 'CA',
    });
    const method = await shipping.createMethod(zone.id, {
      title: 'Concurrent Method',
    });

    const attempts = await Promise.allSettled([
      shipping.createRule(method.id, {
        minimumSubtotal: '0.00',
        maximumSubtotal: '20.00',
        amount: '1.00',
        currency: 'USD',
      }),
      shipping.createRule(method.id, {
        minimumSubtotal: '10.00',
        maximumSubtotal: '30.00',
        amount: '2.00',
        currency: 'USD',
      }),
    ]);

    expect(
      attempts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    await expect(
      dataSource.getRepository(CommerceAuditEvent).countBy({
        action: CommerceAuditAction.SHIPPING_RULE_CREATED,
        targetType: 'shipping_rule',
      }),
    ).resolves.toBe(1);
  });

  it('enforces session, CSRF, customer ownership, and Admin permissions over HTTP', async () => {
    const customer = request.agent(server);
    const customerRegistration = await register(
      customer,
      'commerce-customer@example.com',
    );
    const customerUserId = (customerRegistration.body as { id: string }).id;
    const setup = await CommerceFixture(
      ManualPaymentMethod.CASH_ON_DELIVERY,
      customerUserId,
    );
    const customerToken = await csrf(customer);

    await customer
      .post('/api/v1/checkout/orders')
      .set('Origin', ORIGIN)
      .set('Idempotency-Key', 'missing-csrf')
      .send(submission(setup))
      .expect(403);

    const submitted = await customer
      .post('/api/v1/checkout/orders')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', customerToken)
      .set('Idempotency-Key', 'http-checkout')
      .send(submission(setup))
      .expect(201);
    const orderId = (submitted.body as { id: string }).id;
    const second = await customer
      .post('/api/v1/checkout/orders')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', customerToken)
      .set('Idempotency-Key', 'http-checkout-second')
      .send(submission(setup))
      .expect(201);
    const secondOrderId = (second.body as unknown as { id: string }).id;
    const firstPage = await customer.get('/api/v1/orders?limit=1').expect(200);
    const firstPageBody = firstPage.body as unknown as {
      items: { id: string }[];
      nextCursor: string | null;
    };
    expect(firstPageBody.items).toHaveLength(1);
    expect(typeof firstPageBody.items[0]?.id).toBe('string');
    expect(typeof firstPageBody.nextCursor).toBe('string');
    if (!firstPageBody.nextCursor)
      throw new Error('Expected an Orders next cursor');
    const secondPage = await customer
      .get(
        `/api/v1/orders?limit=1&cursor=${encodeURIComponent(firstPageBody.nextCursor)}`,
      )
      .expect(200);
    const secondPageBody = secondPage.body as unknown as {
      items: { id: string }[];
    };
    expect(
      new Set([firstPageBody.items[0]?.id, secondPageBody.items[0]?.id]),
    ).toEqual(new Set([orderId, secondOrderId]));
    await customer
      .get('/api/v1/orders?cursor=not-a-cursor')
      .expect(400)
      .expect(({ body }) => {
        const problem = body as unknown as { type: string };
        expect(problem.type).toBe('urn:better-commerce:problem:bad-request');
      });
    const submittedAudit = await dataSource
      .getRepository(CommerceAuditEvent)
      .findOneByOrFail({
        action: CommerceAuditAction.ORDER_SUBMITTED,
        targetId: orderId,
      });
    expect(submittedAudit.actorUserId).toBe(customerUserId);
    expect(submittedAudit.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const otherCustomer = request.agent(server);
    await register(otherCustomer, 'other-customer@example.com');
    await otherCustomer.get(`/api/v1/orders/${orderId}`).expect(404);
    const otherToken = await csrf(otherCustomer);
    await otherCustomer
      .post(`/api/v1/admin/orders/${orderId}/accept`)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', otherToken)
      .send({})
      .expect(403);

    const ownerEmail = 'commerce-owner@example.com';
    const ownerRegistration = await register(request.agent(server), ownerEmail);
    const ownerUserId = (ownerRegistration.body as { id: string }).id;
    await ownerBootstrap.bootstrap(ownerEmail);
    const owner = request.agent(server);
    await login(owner, ownerEmail);
    const ownerToken = await csrf(owner);
    const auditPage = await owner
      .get('/api/v1/admin/commerce-audit-events?limit=1')
      .expect(200);
    const auditPageBody = auditPage.body as unknown as {
      items: { action: string }[];
      nextCursor: string | null;
    };
    expect(auditPageBody.items).toHaveLength(1);
    expect(auditPageBody.items[0]?.action).toBe('orders.submitted');
    expect(typeof auditPageBody.nextCursor).toBe('string');
    await owner
      .get('/api/v1/admin/commerce-audit-events?cursor=not-a-cursor')
      .expect(400);
    await owner
      .post(`/api/v1/admin/orders/${orderId}/accept`)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', ownerToken)
      .send({})
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: orderId,
          status: CommerceOrderStatus.ACCEPTED,
        });
      });

    const [decision] = await dataSource.query<
      { decision_actor_user_id: string }[]
    >('SELECT decision_actor_user_id FROM commerce_orders WHERE id = $1', [
      orderId,
    ]);
    expect(decision?.decision_actor_user_id).toBe(ownerUserId);
  });
});
