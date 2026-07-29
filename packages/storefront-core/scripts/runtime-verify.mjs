import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createStorefrontBrowser,
  isStorefrontBrowserError,
  StorefrontCheckoutSessionChangedError,
} from '../dist/browser.js';
import { createStorefrontServer } from '../dist/server.js';

const requests = [];
const controller = new AbortController();
const storefront = createStorefrontServer({
  baseUrl: 'http://api:3000',
  signal: controller.signal,
  fetch: async (request) => {
    requests.push(request);
    return Response.json({
      items: [
        {
          id: '78dbb65f-0d82-4c9f-86f5-182d58734acb',
          slug: 'dog-house',
          title: 'Dog house',
          summary: 'A warm home',
          description: 'A warm home for a dog',
          publishedAt: '2026-07-27T00:00:00.000Z',
          createdAt: '2026-07-27T00:00:00.000Z',
          updatedAt: '2026-07-27T00:00:00.000Z',
          options: [],
          variants: [],
          priceRange: {
            minimum: { amount: '120.00', currency: 'USD' },
            maximum: { amount: '120.00', currency: 'USD' },
            varies: false,
          },
          availability: 'in_stock',
        },
      ],
      nextCursor: 'next-page',
    });
  },
});

const page = await storefront.listPublicProducts({
  cursor: 'current-page',
  limit: 12,
  query: 'dog',
});

assert.equal(page.items[0]?.title, 'Dog house');
assert.equal(page.items[0]?.variantCount, 0);
assert.deepEqual(page.items[0]?.priceRange, {
  minimum: { amount: '120.00', currency: 'USD' },
  maximum: { amount: '120.00', currency: 'USD' },
  varies: false,
});
assert.equal(page.items[0]?.availability, 'in_stock');
assert.equal(page.nextCursor, 'next-page');
assert.deepEqual(page.cache, {
  visibility: 'public',
  cacheKeyParts: [
    'catalog-products',
    'cursor=current-page',
    'limit=12',
    'query=dog',
  ],
});
assert.equal(requests.length, 1);
assert.equal(requests[0].signal.aborted, false);
controller.abort();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(requests[0].signal.aborted, true);
assert.equal(
  requests[0].url,
  'http://api:3000/api/v1/catalog/products?cursor=current-page&limit=12&q=dog',
);

await verifyBrowserProtocols();
await verifyEntryPointBoundaries();

async function verifyEntryPointBoundaries() {
  const browserSource = await readFile(
    new URL('../dist/browser.js', import.meta.url),
    'utf8',
  );
  const serverSource = await readFile(
    new URL('../dist/server.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(browserSource, /node:|from ['"](?:next|react)|\.\/server/);
  assert.doesNotMatch(serverSource, /\.\/browser/);
}

async function verifyBrowserProtocols() {
  const browserRequests = [];
  let csrfIssue = 0;
  let forceCsrfRejection = true;
  let forceUncertainFailure = false;
  const order = { id: 'order-1', orderNumber: '1001' };
  const customer = {
    id: 'b50abb57-4e5b-4b61-8058-cf10e50794ca',
    email: 'customer@example.test',
    emailVerified: false,
  };

  const browser = createStorefrontBrowser({
    baseUrl: 'https://shop.example.test',
    generateIdempotencyKey: (() => {
      let sequence = 0;
      return () => `checkout-test-${++sequence}`;
    })(),
    fetch: async (request) => {
      browserRequests.push({
        body: request.method === 'POST' ? await request.clone().text() : '',
        credentials: request.credentials,
        headers: new Headers(request.headers),
        method: request.method,
        url: request.url,
      });
      const path = new URL(request.url).pathname;

      if (path === '/api/v1/auth/csrf') {
        csrfIssue += 1;
        return Response.json({ csrfToken: `csrf-${csrfIssue}` });
      }
      if (path === '/api/v1/auth/login') {
        const login = JSON.parse(browserRequests.at(-1).body);
        return Response.json(
          login.email === customer.email
            ? customer
            : {
                ...customer,
                id: 'd4a85df5-4dd2-442e-a0ac-8d7517765c1b',
                email: login.email,
              },
        );
      }
      if (path === '/api/v1/auth/me') return Response.json(customer);
      if (path === '/api/v1/cart') {
        return Response.json({
          id: null,
          version: 0,
          status: 'active',
          expiresAt: null,
          lines: [],
        });
      }
      if (path === '/api/v1/cart/checkout-preparation') {
        return Response.json({
          cartId: '78dbb65f-0d82-4c9f-86f5-182d58734acb',
          cartVersion: 3,
          merchandiseSubtotal: { amount: '20.00', currency: 'USD' },
          shippingMethods: [
            {
              methodId: '8181dfd8-0d0a-40e5-926d-2e5a13b65abd',
              methodTitle: 'Standard',
              charge: { amount: '1.00', currency: 'USD' },
            },
          ],
        });
      }
      if (path === '/api/v1/checkout/cart-orders') {
        if (forceCsrfRejection) {
          forceCsrfRejection = false;
          return Response.json(
            {
              type: 'urn:better-commerce:problem:http-403',
              title: 'Forbidden',
              status: 403,
              detail: 'CSRF token is invalid',
              requestId: 'request-csrf',
              code: 'security.csrf_invalid',
            },
            { status: 403 },
          );
        }
        if (forceUncertainFailure) {
          forceUncertainFailure = false;
          throw new TypeError('Failed to fetch');
        }
        return Response.json(order, { status: 201 });
      }
      if (path === '/api/v1/orders') {
        return Response.json({ items: [order], nextCursor: null });
      }
      throw new Error(`Unexpected browser request: ${request.method} ${path}`);
    },
  });

  const snapshots = [];
  browser.session.subscribe((snapshot) => snapshots.push(snapshot));
  await browser.session.login({
    email: 'customer@example.test',
    password: 'correct horse battery staple',
  });
  assert.equal(browser.session.getSnapshot().status, 'authenticated');
  assert.equal(snapshots.at(-1)?.status, 'authenticated');

  const preparation = await browser.cart.prepareCheckout({
    recipientName: 'Test customer',
    phone: '09120000000',
    country: 'IR',
    city: 'Tehran',
    line1: 'Test address',
    postalCode: '1234567890',
  });
  assert.equal(preparation.shippingMethods[0]?.methodTitle, 'Standard');

  const checkoutInput = {
    cartId: '78dbb65f-0d82-4c9f-86f5-182d58734acb',
    cartVersion: 3,
    shippingMethodId: '8181dfd8-0d0a-40e5-926d-2e5a13b65abd',
    paymentMethod: 'cash_on_delivery',
    deliveryAddress: {
      recipientName: 'Test customer',
      phone: '09120000000',
      country: 'IR',
      city: 'Tehran',
      line1: 'Test address',
      postalCode: '1234567890',
    },
  };
  const submission = browser.checkout.createSubmission(checkoutInput);
  assert.equal(submission.idempotencyKey, 'checkout-test-1');
  assert.equal((await submission.submit()).id, 'order-1');
  assert.equal((await submission.submit()).id, 'order-1');

  const checkoutRequests = browserRequests.filter(
    (request) =>
      new URL(request.url).pathname === '/api/v1/checkout/cart-orders',
  );
  assert.equal(checkoutRequests.length, 2);
  assert.equal(
    checkoutRequests[0].headers.get('idempotency-key'),
    'checkout-test-1',
  );
  assert.equal(
    checkoutRequests[1].headers.get('idempotency-key'),
    'checkout-test-1',
  );
  assert.equal(checkoutRequests[0].body, checkoutRequests[1].body);
  assert.equal(checkoutRequests[0].headers.get('x-csrf-token'), 'csrf-2');
  assert.equal(checkoutRequests[1].headers.get('x-csrf-token'), 'csrf-3');

  forceUncertainFailure = true;
  const uncertain = browser.checkout.createSubmission(checkoutInput);
  await assert.rejects(
    uncertain.submit(),
    (error) => isStorefrontBrowserError(error) && error.problem.kind === 'network',
  );
  assert.equal((await uncertain.submit()).id, 'order-1');
  const uncertainRequests = browserRequests.filter(
    (request) =>
      request.headers.get('idempotency-key') === uncertain.idempotencyKey,
  );
  assert.equal(uncertainRequests.length, 2);
  assert.equal(uncertainRequests[0].body, uncertainRequests[1].body);

  const orders = await browser.orders.list({ limit: 10 });
  assert.equal(orders.items[0]?.id, 'order-1');
  const staleSubmission = browser.checkout.createSubmission(checkoutInput);
  await browser.session.getCurrentCustomer();
  await browser.session.login({
    email: 'other-session@example.test',
    password: 'correct horse battery staple',
  });
  assert.throws(
    () => staleSubmission.submit(),
    StorefrontCheckoutSessionChangedError,
  );
  assert.ok(
    browserRequests.every((request) => request.credentials === 'include'),
  );
}
