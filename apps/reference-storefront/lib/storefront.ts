import { createStorefrontServer } from '@better-commerce/storefront-core/server';

const apiBaseUrl = process.env.BETTER_COMMERCE_API_URL ?? 'http://127.0.0.1:3000';

/**
 * Public catalog access needs no customer context. Authenticated rendering must
 * create a request-scoped facade and explicitly forward only allowed headers.
 */
export function getStorefrontServer() {
  return createStorefrontServer({ baseUrl: apiBaseUrl });
}
