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
 * Creates the environment-neutral, generated-backed API client.
 *
 * Prefer the explicit `@better-commerce/sdk/browser` and
 * `@better-commerce/sdk/server` entry points when the runtime is known. This
 * neutral factory does not guess credential, cookie, origin, or cache policy.
 * CSRF and checkout orchestration belong in storefront-core.
 */
export function createBetterCommerceClient(
  options: ClientOptions = {},
): BetterCommerceClient {
  return createClient<paths>(options);
}
