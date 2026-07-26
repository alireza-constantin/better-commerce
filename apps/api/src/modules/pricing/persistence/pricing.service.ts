import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, IsNull } from 'typeorm';
import type { ApplicationConfiguration } from '../../../platform/config';
import type { DatabaseTransactionContext } from '../../../platform/database';
import { DatabaseTransactionRunner } from '../../../platform/database';
import { unwrapTypeOrmTransaction } from '../../../platform/database/typeorm-transaction-context';
import {
  CATALOG_MODULE_CONTRACT,
  type CatalogModuleContract,
} from '../../catalog';
import {
  COMMERCE_AUDIT_CONTRACT,
  CommerceAuditAction,
  type CommerceAuditContract,
} from '../../commerce-audit';
import { formatMoney, parseMoney } from '../money';
import { PriceVersion } from '../price-version.entity';
import {
  PRICING_MODULE_CONTRACT,
  type PricingModuleContract,
  type VariantPriceQuote,
} from '../pricing.contract';

@Injectable()
export class PricingService implements PricingModuleContract {
  private readonly currency: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: DatabaseTransactionRunner,
    config: ConfigService<ApplicationConfiguration, true>,
    @Inject(CATALOG_MODULE_CONTRACT)
    private readonly catalog: CatalogModuleContract,
    @Inject(COMMERCE_AUDIT_CONTRACT)
    private readonly audit: CommerceAuditContract,
  ) {
    this.currency =
      config.getOrThrow<ApplicationConfiguration['commerce']>(
        'commerce',
      ).currency;
  }

  async setCurrentPrice(
    variantId: string,
    amount: string,
    actorUserId: string,
    requestId: string | null = null,
  ) {
    const money = parseMoney(amount, this.currency);
    if (money.minorAmount <= 0n) throw new Error('Price must be positive');
    const [variant] = await this.catalog.resolvePurchasableVariants([
      variantId,
    ]);
    if (!variant) throw new Error('Variant was not found');
    return this.transactions.run(async (transaction) => {
      const manager = unwrapTypeOrmTransaction(transaction);
      const repository = manager.getRepository(PriceVersion);
      const current = await repository.findOne({
        where: { variantId, currency: this.currency, effectiveUntil: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      const now = new Date();
      if (current) {
        current.effectiveUntil = now;
        await repository.save(current);
      }
      const version = repository.create({
        variantId,
        minorAmount: money.minorAmount.toString(),
        currency: this.currency,
        effectiveFrom: now,
        effectiveUntil: null,
        createdByUserId: actorUserId,
      });
      await repository.save(version);
      await this.audit.record(
        {
          actorUserId,
          action: CommerceAuditAction.PRICE_CHANGED,
          targetType: 'variant',
          targetId: variantId,
          requestId,
          metadata: {
            priceVersionId: version.id,
            amount,
            currency: this.currency,
          },
        },
        transaction,
      );
      return this.toResponse(version);
    });
  }

  async quoteVariantPrices(
    variantIds: readonly string[],
    transaction?: DatabaseTransactionContext,
  ): Promise<readonly VariantPriceQuote[]> {
    const ids = [...new Set(variantIds)];
    if (!ids.length) return [];
    const manager = transaction
      ? unwrapTypeOrmTransaction(transaction)
      : this.dataSource.manager;
    const prices = await manager
      .getRepository(PriceVersion)
      .createQueryBuilder('price')
      .where('price.variant_id IN (:...ids)', { ids })
      .andWhere('price.currency = :currency', { currency: this.currency })
      .andWhere('price.effective_until IS NULL')
      .getMany();
    const byVariant = new Map(prices.map((price) => [price.variantId, price]));
    return ids.map((variantId) => {
      const price = byVariant.get(variantId);
      if (!price)
        throw new Error(`Missing current price for Variant ${variantId}`);
      return {
        variantId,
        priceVersionId: price.id,
        unitPrice: {
          minorAmount: BigInt(price.minorAmount),
          currency: price.currency,
        },
      };
    });
  }

  async listCurrentPrices(variantIds: readonly string[]) {
    const quotes = await this.quoteVariantPrices(variantIds);
    return quotes.map((quote) => ({
      variantId: quote.variantId,
      priceVersionId: quote.priceVersionId,
      ...formatMoney(quote.unitPrice),
    }));
  }

  private toResponse(price: PriceVersion) {
    return {
      id: price.id,
      variantId: price.variantId,
      ...formatMoney({
        minorAmount: BigInt(price.minorAmount),
        currency: price.currency,
      }),
      effectiveFrom: price.effectiveFrom,
    };
  }
}

export { PRICING_MODULE_CONTRACT };
