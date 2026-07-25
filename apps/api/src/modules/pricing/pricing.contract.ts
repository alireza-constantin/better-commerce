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

export interface PricingModuleContract {
  quoteVariantPrices(
    variantIds: readonly string[],
    transaction?: DatabaseTransactionContext,
  ): Promise<readonly VariantPriceQuote[]>;
}
