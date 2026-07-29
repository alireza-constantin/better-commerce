import {
  createServerBetterCommerceClient,
  type BetterCommerceServerClientOptions,
} from '@better-commerce/sdk/server';
import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import {
  StorefrontApiError,
  type StorefrontProductDetail,
  type StorefrontProductListItem,
  type StorefrontProductListPage,
} from './index.js';

export interface StorefrontServerOptions
  extends Omit<BetterCommerceServerClientOptions, 'headers'> {
  /** A request signal supplied by the selected renderer, when available. */
  readonly signal?: AbortSignal;
}

export interface ListPublicProductsOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly query?: string;
  readonly signal?: AbortSignal;
}

/**
 * Creates a small, request-scoped server facade for public catalog reads.
 * It deliberately accepts no inbound headers because public catalog reads do
 * not need customer context. A future personalized facade will explicitly
 * allowlist its customer context rather than accepting a raw header collection.
 * The renderer chooses its own cache mechanism; this facade only exposes the
 * full cache-key inputs and propagates cancellation to the HTTP request.
 */
export function createStorefrontServer(options: StorefrontServerOptions) {
  const { signal, ...clientOptions } = options;
  const client = createServerBetterCommerceClient(clientOptions);

  return {
    async listPublicProducts(
      query: ListPublicProductsOptions = {},
    ): Promise<StorefrontProductListPage> {
      const response = await client.GET('/api/v1/catalog/products', {
        params: {
          query: compactQuery({
            cursor: query.cursor,
            limit: query.limit,
            q: query.query,
          }),
        },
        signal: query.signal ?? signal,
      });

      if (!response.data) {
        throw toStorefrontApiError(response.response.status, response.error);
      }

      return {
        items: response.data.items.map(toProductListItem),
        nextCursor: response.data.nextCursor,
        cache: {
          visibility: 'public',
          cacheKeyParts: [
            'catalog-products',
            `cursor=${query.cursor ?? ''}`,
            `limit=${query.limit ?? ''}`,
            `query=${query.query ?? ''}`,
          ],
        },
      };
    },

    async getPublicProduct(
      slug: string,
      requestOptions: { readonly signal?: AbortSignal } = {},
    ): Promise<StorefrontProductDetail> {
      const response = await client.GET('/api/v1/catalog/products/{slug}', {
        params: { path: { slug } },
        signal: requestOptions.signal ?? signal,
      });

      if (!response.data) {
        throw toStorefrontApiError(response.response.status, response.error);
      }

      return {
        canonicalSlug: response.data.canonicalSlug,
        requestedSlugIsCanonical: response.data.requestedSlugIsCanonical,
        product: {
          ...toProductListItem(response.data.product),
          description: response.data.product.description,
          publishedAt: response.data.product.publishedAt,
          variants: response.data.product.variants.map((variant) => ({
            id: variant.id,
            title: variant.title,
            sku: variant.sku,
            position: variant.position,
            price: variant.price,
            availability: variant.availability,
            purchasable: variant.purchasable,
          })),
        },
        cache: {
          visibility: 'public',
          cacheKeyParts: ['catalog-product', `slug=${slug}`],
        },
      };
    },
  };
}

export type StorefrontServer = ReturnType<typeof createStorefrontServer>;

function compactQuery<T extends Record<string, string | number | undefined>>(
  value: T,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Record<string, string | number>;
}

function toProductListItem(
  product: BetterCommerceApiSchemas['PublicProductResponseDto'],
): StorefrontProductListItem {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    summary: product.summary,
    variantCount: product.variants.length,
    priceRange: product.priceRange,
    availability: product.availability,
    media: product.media,
  };
}

function toStorefrontApiError(status: number, error: unknown): StorefrontApiError {
  const problem = asProblemDetails(error);
  return new StorefrontApiError({
    status,
    code: problem?.code,
    message: problem?.detail ?? problem?.title ?? 'Catalog request failed',
  });
}

function asProblemDetails(
  value: unknown,
): { code?: string; detail?: string; title?: string } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
    title: typeof candidate.title === 'string' ? candidate.title : undefined,
  };
}
