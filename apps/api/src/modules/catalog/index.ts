/** Catalog's intentionally narrow cross-module entry point. */
export { CatalogModule } from './catalog.module';
export { CATALOG_MODULE_CONTRACT } from './application/catalog-contract';
export type {
  CatalogModuleContract,
  PublicCatalogPage,
  PublicCatalogProduct,
  PublicCatalogQuery,
  PublicCatalogResolution,
  PurchasableVariantResolution,
  VariantSnapshotFact,
} from './application/catalog-contract';
export { CatalogApplicationError } from './application/catalog-application.error';
export type { FulfillmentClassification } from './domain';
