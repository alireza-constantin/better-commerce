import type {
  FulfillmentClassification,
  ProductStatus,
  VariantStatus,
} from '../domain';

export const CATALOG_MODULE_CONTRACT = Symbol('catalog-module-contract');

export interface PurchasableVariantResolution {
  readonly productId: string;
  readonly variantId: string;
  readonly productStatus: ProductStatus;
  readonly variantStatus: VariantStatus;
  readonly eligible: boolean;
  readonly title: string;
  readonly sku: string | null;
  readonly fulfillmentClassification: FulfillmentClassification;
}

export interface VariantSnapshotFact {
  readonly productId: string;
  readonly variantId: string;
  readonly productTitle: string;
  readonly variantTitle: string | null;
  readonly sku: string | null;
  readonly productStatus: ProductStatus;
  readonly variantStatus: VariantStatus;
  readonly fulfillmentClassification: FulfillmentClassification;
}

export interface PublicCatalogQuery {
  readonly limit?: number;
  readonly cursor?: string;
  readonly q?: string;
}

export interface PublicCatalogProduct {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly slug: string;
  readonly publishedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly media: readonly {
    id: string;
    url: string;
    altText: string;
    position: number;
    mediaType: string;
    width: number;
    height: number;
  }[];
  readonly options: readonly {
    id: string;
    name: string;
    position: number;
    values: readonly { id: string; label: string; position: number }[];
  }[];
  readonly variants: readonly {
    id: string;
    title: string | null;
    sku: string | null;
    fulfillmentClassification: FulfillmentClassification;
    position: number;
    selectionValueIds: readonly string[];
  }[];
}

export interface PublicCatalogPage {
  readonly items: readonly PublicCatalogProduct[];
  readonly nextCursor: string | null;
}

export interface PublicCatalogResolution {
  readonly product: PublicCatalogProduct;
  readonly canonicalSlug: string;
  readonly requestedSlugIsCanonical: boolean;
}

export interface PublicCatalogCategory {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly slug: string;
  readonly parentId: string | null;
  readonly position: number;
}

export interface PublicCatalogCollection {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly slug: string;
}

export interface PublicCategoryResolution {
  readonly category: PublicCatalogCategory;
  readonly canonicalSlug: string;
  readonly requestedSlugIsCanonical: boolean;
}

export interface PublicCollectionResolution {
  readonly collection: PublicCatalogCollection;
  readonly canonicalSlug: string;
  readonly requestedSlugIsCanonical: boolean;
}

/** The only supported in-process dependency surface for other modules. */
export interface CatalogModuleContract {
  listPublished(query?: PublicCatalogQuery): Promise<PublicCatalogPage>;
  resolvePublishedSlug(slug: string): Promise<PublicCatalogResolution>;
  listCategoryNavigation(): Promise<readonly PublicCatalogCategory[]>;
  resolveCategorySlug(slug: string): Promise<PublicCategoryResolution>;
  listCategoryPublishedProducts(
    slug: string,
    query?: PublicCatalogQuery,
  ): Promise<PublicCatalogPage>;
  listCollections(): Promise<readonly PublicCatalogCollection[]>;
  resolveCollectionSlug(slug: string): Promise<PublicCollectionResolution>;
  listCollectionPublishedProducts(
    slug: string,
    query?: PublicCatalogQuery,
  ): Promise<PublicCatalogPage>;
  resolvePurchasableVariants(
    variantIds: readonly string[],
  ): Promise<readonly PurchasableVariantResolution[]>;
  getVariantSnapshotFacts(
    variantIds: readonly string[],
  ): Promise<readonly VariantSnapshotFact[]>;
}
