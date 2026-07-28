import { type StorefrontProductListPage } from '@better-commerce/storefront-core';
import { createStorefrontServer } from '@better-commerce/storefront-core/server';

/**
 * This intentionally resembles an Astro or any other fetch-based SSR route.
 * It imports no Next.js request, cache, router, or rendering API.
 */
export async function renderCatalog(request: Request): Promise<string> {
  const storefront = createStorefrontServer({
    baseUrl: 'http://api:3000',
    signal: request.signal,
  });
  const page: StorefrontProductListPage =
    await storefront.listPublicProducts({ limit: 12 });

  return page.items.map((product) => product.title).join(', ');
}

// @ts-expect-error Public catalog reads do not forward arbitrary inbound headers.
createStorefrontServer({ baseUrl: 'http://api:3000', headers: new Headers() });
