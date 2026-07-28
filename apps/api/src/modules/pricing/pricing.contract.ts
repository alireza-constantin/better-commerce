import type { DatabaseTransactionContext } from '../../platform/database';

export const PRICING_MODULE_CONTRACT = Symbol('pricing-module-contract');

export interface Money {
  readonly minorAmount: bigint;
  readonly currency: string;
}

export interface VariantPriceQuote {
  readonly variantId: string;
  readonly priceVersionId: string;
  readonly unitPrice: Money;
}

export interface PublicVariantPriceProjection {
  readonly variantId: string;
  readonly unitPrice: Money;
}

export interface PricingModuleContract {
  /** Returns configured current prices only; missing prices are not errors. */
  readPublicVariantPrices(
    variantIds: readonly string[],
  ): Promise<readonly PublicVariantPriceProjection[]>;
  quoteVariantPrices(
    variantIds: readonly string[],
    transaction?: DatabaseTransactionContext,
  ): Promise<readonly VariantPriceQuote[]>;
}
