export type CatalogApplicationErrorCode =
  | 'catalog.validation_failed'
  | 'catalog.not_found'
  | 'catalog.slug_conflict'
  | 'catalog.sku_conflict'
  | 'catalog.version_conflict'
  | 'catalog.invalid_product_transition'
  | 'catalog.configuration_conflict'
  | 'catalog.media_invalid'
  | 'catalog.media_storage_failed'
  | 'catalog.category_not_found'
  | 'catalog.collection_not_found'
  | 'catalog.category_slug_conflict'
  | 'catalog.collection_slug_conflict'
  | 'catalog.category_hierarchy_conflict'
  | 'catalog.category_transition_conflict'
  | 'catalog.collection_transition_conflict'
  | 'catalog.membership_conflict';

/** A transport-neutral, stable error surface for Catalog application callers. */
export class CatalogApplicationError extends Error {
  constructor(
    readonly code: CatalogApplicationErrorCode,
    message: string,
    readonly currentVersion?: number,
  ) {
    super(message);
  }
}
