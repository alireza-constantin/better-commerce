import assert from 'node:assert/strict';
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
