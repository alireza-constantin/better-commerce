import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_MODULE_CONTRACT,
  type CatalogModuleContract,
  type PublicCatalogProduct,
  type PublicCatalogQuery,
} from '../catalog';
import {
  INVENTORY_MODULE_CONTRACT,
  type InventoryModuleContract,
  type PublicVariantAvailability,
} from '../inventory';
import {
  formatMoney,
  PRICING_MODULE_CONTRACT,
  type Money,
  type PricingModuleContract,
} from '../pricing';

const PROJECTION_BATCH_SIZE = 500;

@Injectable()
export class PublicCommerceService {
  constructor(
    @Inject(CATALOG_MODULE_CONTRACT)
    private readonly catalog: CatalogModuleContract,
    @Inject(PRICING_MODULE_CONTRACT)
    private readonly pricing: PricingModuleContract,
    @Inject(INVENTORY_MODULE_CONTRACT)
    private readonly inventory: InventoryModuleContract,
  ) {}

  async listProducts(query: PublicCatalogQuery = {}) {
    const page = await this.catalog.listPublished(query);
    return {
      items: await this.enrichProducts(page.items),
      nextCursor: page.nextCursor,
    };
  }

  async resolveProduct(slug: string) {
    const resolution = await this.catalog.resolvePublishedSlug(slug);
    const [product] = await this.enrichProducts([resolution.product]);
    return { ...resolution, product };
  }

  private async enrichProducts(products: readonly PublicCatalogProduct[]) {
    const variantIds = [
      ...new Set(
        products.flatMap((product) => product.variants.map((v) => v.id)),
      ),
    ];
    const batches = chunk(variantIds, PROJECTION_BATCH_SIZE);
    const [priceBatches, availabilityBatches] = await Promise.all([
      Promise.all(
        batches.map((ids) => this.pricing.readPublicVariantPrices(ids)),
      ),
      Promise.all(
        batches.map((ids) => this.inventory.readPublicVariantAvailability(ids)),
      ),
    ]);
    const prices = new Map(
      priceBatches.flat().map((price) => [price.variantId, price.unitPrice]),
    );
    const availability = new Map(
      availabilityBatches
        .flat()
        .map((item) => [item.variantId, item.availability]),
    );

    return products.map((product) => {
      const variants = product.variants.map((variant) => {
        const unitPrice = prices.get(variant.id) ?? null;
        const state = availability.get(variant.id) ?? 'unavailable';
        return {
          ...variant,
          price: unitPrice ? formatMoney(unitPrice) : null,
          availability: state,
          purchasable: unitPrice !== null && state === 'in_stock',
        };
      });
      const productAvailability = summarizeAvailability(variants);

      return {
        ...product,
        variants,
        priceRange: priceRange(
          variants.flatMap((variant) => {
            const price = prices.get(variant.id);
            return price ? [price] : [];
          }),
        ),
        availability: productAvailability,
      };
    });
  }
}

function summarizeAvailability(
  variants: readonly {
    readonly price: { amount: string; currency: string } | null;
    readonly availability: PublicVariantAvailability;
    readonly purchasable: boolean;
  }[],
): PublicVariantAvailability {
  if (variants.some((variant) => variant.purchasable)) return 'in_stock';
  if (
    variants.some(
      (variant) =>
        variant.price !== null && variant.availability === 'out_of_stock',
    )
  )
    return 'out_of_stock';
  return 'unavailable';
}

function priceRange(prices: readonly Money[]) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((left, right) => {
    if (left.currency !== right.currency)
      return left.currency.localeCompare(right.currency);
    return left.minorAmount < right.minorAmount
      ? -1
      : left.minorAmount > right.minorAmount
        ? 1
        : 0;
  });
  const minimum = sorted[0];
  const maximum = sorted.at(-1);
  if (!minimum || !maximum) return null;
  return {
    minimum: formatMoney(minimum),
    maximum: formatMoney(maximum),
    varies:
      minimum.currency !== maximum.currency ||
      minimum.minorAmount !== maximum.minorAmount,
  };
}

function chunk<T>(items: readonly T[], size: number): readonly T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
