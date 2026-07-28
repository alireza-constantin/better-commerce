import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { createServerBetterCommerceClient } from '@better-commerce/sdk/server';

const client = createServerBetterCommerceClient({
  baseUrl: 'http://api:3000',
  headers: {
    cookie: 'bc.sid=opaque-request-scoped-value',
  },
});

const exampleProduct:
  | BetterCommerceApiSchemas['PublicProductResponseDto']
  | undefined = undefined;

void exampleProduct;
void client.GET('/api/v1/catalog/products');

// @ts-expect-error A server client must never guess an ambient API origin.
createServerBetterCommerceClient({});
