import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { ApplicationConfiguration } from '../../platform/config';
import {
  DatabaseTransactionContext,
  DatabaseTransactionRunner,
} from '../../platform/database';
import { unwrapTypeOrmTransaction } from '../../platform/database/typeorm-transaction-context';
import { Promotion } from './promotion.entity';
import { PromotionDefinitionVersion } from './promotion-definition-version.entity';
import { PromotionRedemption } from './promotion-redemption.entity';
import {
  PROMOTIONS_MODULE_CONTRACT,
  type PromotionQuoteInput,
  type PromotionsModuleContract,
} from './promotions.contract';
import { calculateDiscount, normalizeDefinition } from './promotions.domain';
import { PromotionDomainError } from './promotions.errors';
import type {
  PromotionDefinitionInput,
  PromotionRule,
  PromotionStatus,
} from './promotions.types';

@Injectable()
export class PromotionsService implements PromotionsModuleContract {
  private readonly currency: string;

  constructor(
    private readonly transactions: DatabaseTransactionRunner,
    config: ConfigService<ApplicationConfiguration, true>,
  ) {
    this.currency =
      config.getOrThrow<ApplicationConfiguration['commerce']>(
        'commerce',
      ).currency;
  }

  calculateDiscount(input: PromotionQuoteInput) {
    return calculateDiscount(
      {
        id: input.definition.promotionId,
        definitionVersion: input.definition.id,
        name: input.definition.name,
        code: input.definition.code ?? null,
        rule: input.definition.rule,
        target: input.definition.target,
      },
      input.lines,
      input.currency,
    );
  }

  createDraft(input: {
    readonly definition: PromotionDefinitionInput;
    readonly actorUserId: string;
  }) {
    return this.transactions.run((transaction) =>
      this.createDraftInTransaction(
        input.definition,
        input.actorUserId,
        transaction,
      ),
    );
  }

  replaceDefinition(input: {
    readonly promotionId: string;
    readonly expectedVersion: number;
    readonly definition: PromotionDefinitionInput;
    readonly actorUserId: string;
  }) {
    return this.transactions.run((transaction) =>
      this.replaceDefinitionInTransaction(input, transaction),
    );
  }

  transition(input: {
    readonly promotionId: string;
    readonly expectedVersion: number;
    readonly status: Extract<
      PromotionStatus,
      'scheduled' | 'active' | 'paused' | 'ended'
    >;
    readonly actorUserId: string;
  }) {
    return this.transactions.run(async (transaction) => {
      const manager = unwrapTypeOrmTransaction(transaction);
      const repository = manager.getRepository(Promotion);
      const promotion = await repository.findOne({
        where: { id: input.promotionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!promotion) {
        throw new PromotionDomainError(
          'promotion.not_found',
          'Promotion was not found',
        );
      }
      this.assertVersion(promotion, input.expectedVersion);
      if (!this.canTransition(promotion.status, input.status)) {
        throw new PromotionDomainError(
          'promotion.invalid_state',
          'Promotion lifecycle transition is invalid',
        );
      }
      if (input.status === 'active' && promotion.startsAt > new Date()) {
        throw new PromotionDomainError(
          'promotion.invalid_state',
          'Promotion has not started',
        );
      }
      promotion.status = input.status;
      promotion.version += 1;
      promotion.updatedByUserId = input.actorUserId;
      return repository.save(promotion);
    });
  }

  async claimRedemption(input: {
    readonly promotionId: string;
    readonly definitionVersionId: string;
    readonly orderId: string;
    readonly customerId: string;
    readonly discount: {
      readonly minorAmount: bigint;
      readonly currency: string;
    };
    readonly transaction: DatabaseTransactionContext;
  }): Promise<void> {
    const manager = unwrapTypeOrmTransaction(input.transaction);
    const promotionRepository = manager.getRepository(Promotion);
    const redemptionRepository = manager.getRepository(PromotionRedemption);
    const promotion = await promotionRepository.findOne({
      where: { id: input.promotionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!promotion) {
      throw new PromotionDomainError(
        'promotion.not_found',
        'Promotion was not found',
      );
    }
    const now = new Date();
    if (
      promotion.status !== 'active' ||
      promotion.startsAt > now ||
      (promotion.endsAt !== null && promotion.endsAt <= now)
    ) {
      throw new PromotionDomainError(
        'promotion.not_eligible',
        'Promotion is unavailable',
      );
    }
    if (
      promotion.totalLimit !== null &&
      promotion.redemptionCount >= promotion.totalLimit
    ) {
      throw new PromotionDomainError(
        'promotion.limit_reached',
        'Promotion redemption limit reached',
      );
    }
    if (promotion.perCustomerLimit !== null) {
      const customerCount = await redemptionRepository.count({
        where: { promotionId: promotion.id, customerId: input.customerId },
      });
      if (customerCount >= promotion.perCustomerLimit) {
        throw new PromotionDomainError(
          'promotion.limit_reached',
          'Customer redemption limit reached',
        );
      }
    }
    if (input.discount.currency !== this.currency) {
      throw new PromotionDomainError(
        'promotion.currency_mismatch',
        'Redemption currency does not match the store currency',
      );
    }
    const existing = await redemptionRepository.findOne({
      where: { promotionId: promotion.id, orderId: input.orderId },
    });
    if (existing) return;
    await redemptionRepository.save(
      redemptionRepository.create({
        promotionId: promotion.id,
        definitionVersionId: input.definitionVersionId,
        orderId: input.orderId,
        customerId: input.customerId,
        discountMinorAmount: input.discount.minorAmount.toString(),
        currency: input.discount.currency,
      }),
    );
    promotion.redemptionCount += 1;
    await promotionRepository.save(promotion);
  }

  private async createDraftInTransaction(
    input: PromotionDefinitionInput,
    actorUserId: string,
    transaction: DatabaseTransactionContext,
  ) {
    const manager = unwrapTypeOrmTransaction(transaction);
    const normalized = normalizeDefinition(input, this.currency);
    const promotionRepository = manager.getRepository(Promotion);
    const versionRepository = manager.getRepository(PromotionDefinitionVersion);
    const promotion = promotionRepository.create({
      status: 'draft',
      version: 1,
      currentDefinitionVersionId: null,
      name: normalized.name,
      code: normalized.code,
      totalLimit: normalized.totalLimit,
      perCustomerLimit: normalized.perCustomerLimit,
      redemptionCount: 0,
      startsAt: normalized.startsAt,
      endsAt: normalized.endsAt ?? null,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    });
    await promotionRepository.save(promotion);
    const definition = await this.saveDefinitionVersion(
      versionRepository,
      promotion,
      normalized,
      actorUserId,
      1,
    );
    promotion.currentDefinitionVersionId = definition.id;
    await promotionRepository.save(promotion);
    return promotion;
  }

  private async replaceDefinitionInTransaction(
    input: {
      promotionId: string;
      expectedVersion: number;
      definition: PromotionDefinitionInput;
      actorUserId: string;
    },
    transaction: DatabaseTransactionContext,
  ) {
    const manager = unwrapTypeOrmTransaction(transaction);
    const promotionRepository = manager.getRepository(Promotion);
    const versionRepository = manager.getRepository(PromotionDefinitionVersion);
    const promotion = await promotionRepository.findOne({
      where: { id: input.promotionId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!promotion) {
      throw new PromotionDomainError(
        'promotion.not_found',
        'Promotion was not found',
      );
    }
    this.assertVersion(promotion, input.expectedVersion);
    if (promotion.status === 'ended') {
      throw new PromotionDomainError(
        'promotion.invalid_state',
        'Ended promotions cannot be edited',
      );
    }
    const normalized = normalizeDefinition(input.definition, this.currency);
    const latest = await versionRepository.findOne({
      where: { promotionId: promotion.id },
      order: { version: 'DESC' },
    });
    const definition = await this.saveDefinitionVersion(
      versionRepository,
      promotion,
      normalized,
      input.actorUserId,
      (latest?.version ?? 0) + 1,
    );
    Object.assign(promotion, {
      currentDefinitionVersionId: definition.id,
      name: normalized.name,
      code: normalized.code,
      totalLimit: normalized.totalLimit,
      perCustomerLimit: normalized.perCustomerLimit,
      startsAt: normalized.startsAt,
      endsAt: normalized.endsAt ?? null,
      version: promotion.version + 1,
      updatedByUserId: input.actorUserId,
    });
    return promotionRepository.save(promotion);
  }

  private async saveDefinitionVersion(
    repository: Repository<PromotionDefinitionVersion>,
    promotion: Promotion,
    input: ReturnType<typeof normalizeDefinition>,
    actorUserId: string,
    version: number,
  ) {
    const rule: PromotionRule = input.rule;
    const definition = repository.create({
      promotionId: promotion.id,
      version,
      name: input.name,
      description: input.description,
      eligibility: input.eligibility,
      code: input.code,
      ruleKind: rule.kind,
      percentageBasisPoints:
        rule.kind === 'percentage'
          ? Number(rule.percentage!.replace('.', ''))
          : null,
      fixedMinorAmount:
        rule.kind === 'fixed_amount'
          ? rule.amount!.minorAmount.toString()
          : null,
      currency: this.currency,
      targetKind: input.target.kind,
      targetIds: input.target.ids,
      priority: input.priority,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      totalLimit: input.totalLimit,
      perCustomerLimit: input.perCustomerLimit,
      createdByUserId: actorUserId,
    });
    return repository.save(definition);
  }

  private assertVersion(promotion: Promotion, expectedVersion: number) {
    if (promotion.version !== expectedVersion) {
      throw new PromotionDomainError(
        'promotion.version_conflict',
        'Promotion has changed; refresh and try again',
      );
    }
  }

  private canTransition(from: PromotionStatus, to: PromotionStatus): boolean {
    const transitions: Record<PromotionStatus, readonly PromotionStatus[]> = {
      draft: ['scheduled', 'active', 'ended'],
      scheduled: ['active', 'paused', 'ended'],
      active: ['paused', 'ended'],
      paused: ['scheduled', 'active', 'ended'],
      ended: [],
    };
    return transitions[from].includes(to);
  }
}

export { PROMOTIONS_MODULE_CONTRACT };
