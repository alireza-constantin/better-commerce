import { ConfigService } from '@nestjs/config';
import { Inject, Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import type { ApplicationConfiguration } from '../../platform/config';
import {
  DatabaseTransactionContext,
  DatabaseTransactionRunner,
} from '../../platform/database';
import { Promotion } from './promotion.entity';
import { PromotionDefinitionVersion } from './promotion-definition-version.entity';
import { PromotionRedemption } from './promotion-redemption.entity';
import {
  PROMOTIONS_MODULE_CONTRACT,
  type PromotionQuoteInput,
  type PromotionsModuleContract,
} from './promotions.contract';
import {
  calculateDiscount,
  normalizeDefinition,
  normalizePromotionCode,
} from './promotions.domain';
import { PromotionDomainError } from './promotions.errors';
import {
  COMMERCE_AUDIT_CONTRACT,
  CommerceAuditAction,
  type CommerceAuditContract,
} from '../commerce-audit';
import type {
  PromotionDefinitionInput,
  PromotionRule,
  PromotionStatus,
} from './promotions.types';
import { formatMoney } from '../pricing';
import { promotionManager } from './persistence/promotions.persistence';

@Injectable()
export class PromotionsService implements PromotionsModuleContract {
  private readonly currency: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: DatabaseTransactionRunner,
    config: ConfigService<ApplicationConfiguration, true>,
    @Inject(COMMERCE_AUDIT_CONTRACT)
    private readonly audit: CommerceAuditContract,
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

  async quoteCode(input: {
    readonly code?: string | null;
    readonly lines: readonly import('./promotions.types').PromotionLineInput[];
    readonly currency: string;
    readonly customerId?: string;
    readonly transaction?: DatabaseTransactionContext;
  }) {
    const manager = promotionManager(this.dataSource, input.transaction);
    const repository = manager.getRepository(Promotion);
    const promotions = await repository.find({ where: { status: 'active' } });
    const normalizedCode = input.code
      ? normalizePromotionCode(input.code)
      : null;
    const candidates: Array<{
      promotion: Promotion;
      definition: PromotionDefinitionVersion;
      quote: ReturnType<typeof calculateDiscount>;
    }> = [];
    for (const promotion of promotions) {
      const now = new Date();
      if (
        promotion.startsAt > now ||
        (promotion.endsAt && promotion.endsAt <= now)
      )
        continue;
      if (
        promotion.totalLimit !== null &&
        promotion.redemptionCount >= promotion.totalLimit
      )
        continue;
      const definition = promotion.currentDefinitionVersionId
        ? await manager
            .getRepository(PromotionDefinitionVersion)
            .findOne({ where: { id: promotion.currentDefinitionVersionId } })
        : null;
      if (!definition) continue;
      if (definition.eligibility === 'code_required') {
        if (!normalizedCode || definition.code !== normalizedCode) continue;
      } else if (normalizedCode) {
        continue;
      }
      if (input.customerId && promotion.perCustomerLimit !== null) {
        const count = await manager.getRepository(PromotionRedemption).count({
          where: { promotionId: promotion.id, customerId: input.customerId },
        });
        if (count >= promotion.perCustomerLimit) continue;
      }
      const quote = calculateDiscount(
        {
          id: promotion.id,
          definitionVersion: definition.id,
          name: definition.name,
          code: definition.code,
          rule:
            definition.ruleKind === 'percentage'
              ? {
                  kind: 'percentage' as const,
                  percentage: `${Math.floor((definition.percentageBasisPoints ?? 0) / 100)}.${String((definition.percentageBasisPoints ?? 0) % 100).padStart(2, '0')}`,
                }
              : {
                  kind: 'fixed_amount' as const,
                  amount: {
                    minorAmount: BigInt(definition.fixedMinorAmount ?? '0'),
                    currency: definition.currency,
                  },
                },
          target: { kind: definition.targetKind, ids: definition.targetIds },
        },
        input.lines,
        input.currency,
      );
      if (quote.status === 'applied')
        candidates.push({ promotion, definition, quote });
    }
    const selected = candidates.sort(
      (left, right) =>
        right.definition.priority - left.definition.priority ||
        left.promotion.id.localeCompare(right.promotion.id),
    )[0];
    if (selected) return selected.quote;
    return {
      status: 'not_applied' as const,
      promotionId: null,
      definitionVersion: null,
      name: null,
      code: normalizedCode,
      discount: { minorAmount: 0n, currency: input.currency },
      allocations: [],
      reason: normalizedCode
        ? ('invalid_code' as const)
        : ('not_eligible' as const),
    };
  }

  async list(input: {
    readonly limit: number;
    readonly cursor?: string;
    readonly status?: PromotionStatus;
    readonly q?: string;
  }) {
    const cursor = this.decodeCursor(input.cursor);
    const query = this.dataSource
      .getRepository(Promotion)
      .createQueryBuilder('promotion')
      .orderBy('promotion.updatedAt', 'DESC')
      .addOrderBy('promotion.id', 'DESC')
      .take(input.limit + 1);
    if (input.status)
      query.andWhere('promotion.status = :status', { status: input.status });
    if (input.q)
      query.andWhere('(promotion.name ILIKE :q OR promotion.code ILIKE :q)', {
        q: `${input.q}%`,
      });
    if (cursor) {
      query.andWhere(
        '(promotion.updated_at < :cursorUpdatedAt OR (promotion.updated_at = :cursorUpdatedAt AND promotion.id < :cursorId))',
        { cursorUpdatedAt: cursor.updatedAt, cursorId: cursor.id },
      );
    }
    const rows = await query.getMany();
    const page = rows.slice(0, input.limit);
    const definitionIds = page
      .map((promotion) => promotion.currentDefinitionVersionId)
      .filter((id): id is string => id !== null);
    const currentDefinitions = definitionIds.length
      ? await this.dataSource
          .getRepository(PromotionDefinitionVersion)
          .findBy({ id: In(definitionIds) })
      : [];
    const byId = new Map(
      currentDefinitions.map((definition) => [definition.id, definition]),
    );
    return {
      items: page.map((promotion) =>
        this.toView(
          promotion,
          byId.get(promotion.currentDefinitionVersionId ?? ''),
        ),
      ),
      nextCursor:
        rows.length > input.limit && page.at(-1)
          ? this.encodeCursor(page.at(-1)!.updatedAt, page.at(-1)!.id)
          : null,
    };
  }

  async get(id: string) {
    const promotion = await this.dataSource
      .getRepository(Promotion)
      .findOne({ where: { id } });
    if (!promotion)
      throw new PromotionDomainError(
        'promotion.not_found',
        'Promotion was not found',
      );
    const definition = promotion.currentDefinitionVersionId
      ? await this.dataSource
          .getRepository(PromotionDefinitionVersion)
          .findOne({ where: { id: promotion.currentDefinitionVersionId } })
      : null;
    return this.toView(promotion, definition ?? undefined);
  }

  async listRedemptions(
    promotionId: string,
    input: { readonly limit: number; readonly cursor?: string },
  ) {
    const promotion = await this.dataSource
      .getRepository(Promotion)
      .findOne({ where: { id: promotionId } });
    if (!promotion) {
      throw new PromotionDomainError(
        'promotion.not_found',
        'Promotion was not found',
      );
    }

    const cursor = this.decodeCursor(input.cursor);
    const query = this.dataSource
      .getRepository(PromotionRedemption)
      .createQueryBuilder('redemption')
      .where('redemption.promotion_id = :promotionId', { promotionId })
      .orderBy('redemption.createdAt', 'DESC')
      .addOrderBy('redemption.id', 'DESC')
      .take(input.limit + 1);
    if (cursor) {
      query.andWhere(
        '(redemption.created_at < :cursorCreatedAt OR (redemption.created_at = :cursorCreatedAt AND redemption.id < :cursorId))',
        { cursorCreatedAt: cursor.updatedAt, cursorId: cursor.id },
      );
    }
    const rows = await query.getMany();
    const page = rows.slice(0, input.limit);
    return {
      items: page.map((redemption) => ({
        id: redemption.id,
        orderId: redemption.orderId,
        customerId: redemption.customerId,
        definitionVersionId: redemption.definitionVersionId,
        discount: formatMoney({
          minorAmount: BigInt(redemption.discountMinorAmount),
          currency: redemption.currency,
        }),
        redeemedAt: redemption.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > input.limit && page.at(-1)
          ? this.encodeCursor(page.at(-1)!.createdAt, page.at(-1)!.id)
          : null,
    };
  }

  createDraft(input: {
    readonly definition: PromotionDefinitionInput;
    readonly actorUserId: string;
    readonly requestId?: string | null;
  }) {
    return this.transactions.run((transaction) =>
      this.createDraftInTransaction(
        input.definition,
        input.actorUserId,
        input.requestId ?? null,
        transaction,
      ),
    );
  }

  replaceDefinition(input: {
    readonly promotionId: string;
    readonly expectedVersion: number;
    readonly definition: PromotionDefinitionInput;
    readonly actorUserId: string;
    readonly requestId?: string | null;
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
    readonly requestId?: string | null;
  }) {
    return this.transactions.run(async (transaction) => {
      const manager = promotionManager(this.dataSource, transaction);
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
      await this.audit.record(
        {
          actorUserId: input.actorUserId,
          action:
            input.status === 'active'
              ? CommerceAuditAction.PROMOTION_ACTIVATED
              : input.status === 'paused'
                ? CommerceAuditAction.PROMOTION_PAUSED
                : CommerceAuditAction.PROMOTION_ENDED,
          targetType: 'promotion',
          targetId: promotion.id,
          requestId: input.requestId ?? null,
          metadata: {},
        },
        transaction,
      );
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
    const manager = promotionManager(this.dataSource, input.transaction);
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
    await this.audit.record(
      {
        actorUserId: null,
        action: CommerceAuditAction.PROMOTION_REDEEMED,
        targetType: 'promotion',
        targetId: promotion.id,
        requestId: null,
        metadata: {
          orderId: input.orderId,
          definitionVersionId: input.definitionVersionId,
          discountAmount: input.discount.minorAmount.toString(),
          currency: input.discount.currency,
        },
      },
      input.transaction,
    );
  }

  private async createDraftInTransaction(
    input: PromotionDefinitionInput,
    actorUserId: string,
    requestId: string | null,
    transaction: DatabaseTransactionContext,
  ) {
    const manager = promotionManager(this.dataSource, transaction);
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
    await this.audit.record(
      {
        actorUserId,
        action: CommerceAuditAction.PROMOTION_CREATED,
        targetType: 'promotion',
        targetId: promotion.id,
        requestId,
        metadata: { definitionVersionId: definition.id },
      },
      transaction,
    );
    return promotion;
  }

  private async replaceDefinitionInTransaction(
    input: {
      promotionId: string;
      expectedVersion: number;
      definition: PromotionDefinitionInput;
      actorUserId: string;
      requestId?: string | null;
    },
    transaction: DatabaseTransactionContext,
  ) {
    const manager = promotionManager(this.dataSource, transaction);
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
    await this.audit.record(
      {
        actorUserId: input.actorUserId,
        action: CommerceAuditAction.PROMOTION_UPDATED,
        targetType: 'promotion',
        targetId: promotion.id,
        requestId: input.requestId ?? null,
        metadata: { definitionVersionId: definition.id },
      },
      transaction,
    );
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

  private toView(
    promotion: Promotion,
    definition?: PromotionDefinitionVersion,
  ) {
    if (!definition)
      throw new PromotionDomainError(
        'promotion.not_found',
        'Promotion definition was not found',
      );
    return {
      id: promotion.id,
      version: promotion.version,
      definitionVersion: definition.id,
      status: promotion.status,
      name: definition.name,
      description: definition.description,
      eligibility: definition.eligibility,
      code: definition.code,
      rule:
        definition.ruleKind === 'percentage'
          ? {
              kind: 'percentage' as const,
              percentage: `${Math.floor((definition.percentageBasisPoints ?? 0) / 100)}.${String((definition.percentageBasisPoints ?? 0) % 100).padStart(2, '0')}`,
            }
          : {
              kind: 'fixed_amount' as const,
              amount: formatMoney({
                minorAmount: BigInt(definition.fixedMinorAmount ?? '0'),
                currency: definition.currency,
              }),
            },
      target: { kind: definition.targetKind, ids: definition.targetIds },
      priority: definition.priority,
      startsAt: definition.startsAt.toISOString(),
      endsAt: definition.endsAt?.toISOString() ?? null,
      totalLimit: definition.totalLimit,
      perCustomerLimit: definition.perCustomerLimit,
      redemptions: { total: promotion.redemptionCount },
      createdAt: promotion.createdAt.toISOString(),
      updatedAt: promotion.updatedAt.toISOString(),
    };
  }

  private encodeCursor(updatedAt: Date, id: string): string {
    return Buffer.from(
      JSON.stringify({ updatedAt: updatedAt.toISOString(), id }),
    ).toString('base64url');
  }

  private decodeCursor(
    value?: string,
  ): { updatedAt: string; id: string } | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as { updatedAt?: unknown; id?: unknown };
      if (
        typeof parsed.updatedAt !== 'string' ||
        Number.isNaN(Date.parse(parsed.updatedAt)) ||
        typeof parsed.id !== 'string'
      )
        throw new Error();
      return { updatedAt: parsed.updatedAt, id: parsed.id };
    } catch {
      throw new BadRequestException('Invalid promotion cursor');
    }
  }
}

export { PROMOTIONS_MODULE_CONTRACT };
