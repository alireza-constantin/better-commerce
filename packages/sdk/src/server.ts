import type { ClientOptions } from 'openapi-fetch';
import {
  createBetterCommerceClient,
  type BetterCommerceClient,
} from './index.js';

export interface BetterCommerceServerClientOptions
  extends Omit<ClientOptions, 'baseUrl' | 'credentials' | 'headers'> {
  /**
   * Explicit API origin or base path for this server runtime. Relative URLs are
   * rejected so server rendering cannot accidentally depend on a process-wide
   * ambient origin.
   */
  readonly baseUrl: string;
  /**
   * Request-scoped headers selected by the integration layer. Callers must not
   * forward an inbound header collection wholesale.
   */
  readonly headers?: HeadersInit;
}

/**
 * Creates one server-side client without a browser cookie jar.
 *
 * Construct this per incoming request whenever headers contain customer
 * context. The SDK clones supplied headers and never retains them globally.
 */
export function createServerBetterCommerceClient(
  options: BetterCommerceServerClientOptions,
): BetterCommerceClient {
  const { baseUrl, headers, ...clientOptions } = options;

  return createBetterCommerceClient({
    ...clientOptions,
    baseUrl: validateServerBaseUrl(baseUrl),
    credentials: 'omit',
    headers: headers ? new Headers(headers) : undefined,
  });
}

function validateServerBaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError('Server API baseUrl must be an absolute HTTP(S) URL');
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new TypeError(
      'Server API baseUrl must be an absolute HTTP(S) URL without credentials, query, or fragment',
    );
  }

  return parsed.toString().replace(/\/$/, '');
}
