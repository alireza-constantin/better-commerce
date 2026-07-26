import createClient, {
  type Client,
  type ClientOptions,
} from 'openapi-fetch';
import type {
  components,
  operations,
  paths,
} from './generated/schema.js';

export type BetterCommerceApiPaths = paths;
export type BetterCommerceApiOperations = operations;
export type BetterCommerceApiSchemas = components['schemas'];
export type BetterCommerceClient = Client<paths>;

/**
 * Creates the low-level generated-backed API client. Browser callers include
 * the HttpOnly session cookie automatically. Server callers must forward the
 * request cookie explicitly through `headers`.
 *
 * CSRF acquisition/rotation and checkout idempotency orchestration belong in
 * storefront-core; this SDK intentionally exposes the exact HTTP contract.
 */
export function createBetterCommerceClient(
  options: ClientOptions = {},
): BetterCommerceClient {
  return createClient<paths>({
    credentials: 'include',
    ...options,
  });
}
