/**
 * Framework-neutral types shared by the storefront server and browser entry
 * points. This module deliberately contains no renderer, React, or browser
 * runtime dependency.
 */
export interface StorefrontCacheMetadata {
  /**
   * Describes the data category; the renderer owns the concrete cache policy.
   */
  readonly visibility: 'public' | 'private';
  /**
   * Inputs which must be represented by a renderer cache key when caching is
   * enabled. This is documentation for adapters, not a cache implementation.
   */
  readonly cacheKeyParts: readonly string[];
}

export interface StorefrontProductListItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly variantCount: number;
  readonly priceRange: StorefrontPriceRange | null;
  readonly availability: StorefrontAvailability;
  readonly media: readonly StorefrontProductMedia[];
}

export interface StorefrontProductMedia {
  readonly id: string;
  readonly url: string;
  readonly altText: string;
  readonly position: number;
  readonly mediaType: string;
  readonly width: number;
  readonly height: number;
}

export type StorefrontAvailability =
  | 'in_stock'
  | 'out_of_stock'
  | 'unavailable';

export interface StorefrontMoney {
  /** Exact decimal string from the API; consumers must not coerce it to Number. */
  readonly amount: string;
  readonly currency: string;
}

export interface StorefrontPriceRange {
  readonly minimum: StorefrontMoney;
  readonly maximum: StorefrontMoney;
  readonly varies: boolean;
}

export interface StorefrontVariantProjection {
  readonly id: string;
  readonly title: string | null;
  readonly sku: string | null;
  readonly position: number;
  readonly price: StorefrontMoney | null;
  readonly availability: StorefrontAvailability;
  readonly purchasable: boolean;
}

export interface StorefrontProductListPage {
  readonly items: readonly StorefrontProductListItem[];
  readonly nextCursor: string | null;
  readonly cache: StorefrontCacheMetadata;
}

export interface StorefrontProductDetail {
  readonly canonicalSlug: string;
  readonly requestedSlugIsCanonical: boolean;
  readonly product: StorefrontProductListItem & {
    readonly description: string | null;
    readonly publishedAt: string;
    readonly variants: readonly StorefrontVariantProjection[];
  };
  readonly cache: StorefrontCacheMetadata;
}

export class StorefrontApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(options: { status: number; message: string; code?: string }) {
    super(options.message);
    this.name = 'StorefrontApiError';
    this.status = options.status;
    this.code = options.code;
  }
}
