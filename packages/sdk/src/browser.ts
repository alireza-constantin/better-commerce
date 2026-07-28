import type { ClientOptions } from 'openapi-fetch';
import {
  createBetterCommerceClient,
  type BetterCommerceClient,
} from './index.js';

export type BetterCommerceBrowserClientOptions = Omit<
  ClientOptions,
  'credentials'
>;

/**
 * Creates a browser client for the same-origin session contract.
 *
 * The browser owns its cookie jar; HttpOnly session cookies remain unreadable
 * to this package and are attached by fetch through `credentials: "include"`.
 */
export function createBrowserBetterCommerceClient(
  options: BetterCommerceBrowserClientOptions = {},
): BetterCommerceClient {
  return createBetterCommerceClient({
    ...options,
    credentials: 'include',
  });
}
