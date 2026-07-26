import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { DatabaseTransactionContext } from '../../../platform/database';
import { DatabaseTransactionRunner } from '../../../platform/database';
import { unwrapTypeOrmTransaction } from '../../../platform/database/typeorm-transaction-context';
import {
  COMMERCE_AUDIT_CONTRACT,
  CommerceAuditAction,
  type CommerceAuditContract,
  type CommerceAuditMetadata,
} from '../../commerce-audit';
import { currencyScale, formatMoney, parseMoney } from '../../pricing';
import type {
  DeliveryAddress,
  ShippingModuleContract,
  ShippingQuote,
} from '../shipping.contract';
import { ShippingMethod } from '../shipping-method.entity';
import { ShippingRateRule } from '../shipping-rate-rule.entity';
import { ShippingZone } from '../shipping-zone.entity';

@Injectable()
export class ShippingService implements ShippingModuleContract {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactions: DatabaseTransactionRunner,
    @Inject(COMMERCE_AUDIT_CONTRACT)
    private readonly audit: CommerceAuditContract,
  ) {}

  async listConfiguration() {
    const [zones, methods, rules] = await Promise.all([
      this.dataSource
        .getRepository(ShippingZone)
        .find({ order: { name: 'ASC' } }),
      this.dataSource
        .getRepository(ShippingMethod)
        .find({ order: { position: 'ASC' } }),
      this.dataSource
        .getRepository(ShippingRateRule)
        .find({ order: { minimumSubtotal: 'ASC' } }),
    ]);
    return {
      zones: zones.map((zone) => this.toZone(zone)),
      methods: methods.map((method) => this.toMethod(method)),
      rules: rules.map((rule) => this.toRule(rule)),
    };
  }

  createZone(
    input: {
      name: string;
      country: string;
      province?: string;
      city?: string;
      postalPrefix?: string;
      active?: boolean;
    },
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    return this.transactions.run(async (transaction) => {
      const repository =
        unwrapTypeOrmTransaction(transaction).getRepository(ShippingZone);
      const zone = await repository.save({
        name: input.name.trim(),
        country: input.country.toUpperCase(),
        province: input.province?.trim() || null,
        city: input.city?.trim() || null,
        postalPrefix: input.postalPrefix?.trim() || null,
        active: input.active ?? true,
      });
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_ZONE_CREATED,
        'shipping_zone',
        zone.id,
        {},
      );
      return this.toZone(zone);
    });
  }

  async updateZone(
    id: string,
    input: Partial<{
      name: string;
      country: string;
      province: string | null;
      city: string | null;
      postalPrefix: string | null;
      active: boolean;
    }>,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    return this.transactions.run(async (transaction) => {
      const repository =
        unwrapTypeOrmTransaction(transaction).getRepository(ShippingZone);
      const zone = await repository.findOneBy({ id });
      if (!zone) throw new Error('Shipping zone was not found');
      if (input.name !== undefined) zone.name = input.name.trim();
      if (input.country !== undefined)
        zone.country = input.country.toUpperCase();
      if (input.province !== undefined)
        zone.province = input.province?.trim() || null;
      if (input.city !== undefined) zone.city = input.city?.trim() || null;
      if (input.postalPrefix !== undefined)
        zone.postalPrefix = input.postalPrefix?.trim() || null;
      if (input.active !== undefined) zone.active = input.active;
      const saved = await repository.save(zone);
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_ZONE_UPDATED,
        'shipping_zone',
        id,
        {},
      );
      return this.toZone(saved);
    });
  }

  async deleteZone(
    id: string,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    await this.transactions.run(async (transaction) => {
      const repository =
        unwrapTypeOrmTransaction(transaction).getRepository(ShippingZone);
      const zone = await repository.findOneBy({ id });
      if (!zone) throw new Error('Shipping zone was not found');
      zone.active = false;
      await repository.save(zone);
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_ZONE_ARCHIVED,
        'shipping_zone',
        id,
        {},
      );
    });
  }

  async createMethod(
    zoneId: string,
    input: { title: string; position?: number; active?: boolean },
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    return this.transactions.run(async (transaction) => {
      const manager = unwrapTypeOrmTransaction(transaction);
      const zone = await manager.getRepository(ShippingZone).findOneBy({
        id: zoneId,
      });
      if (!zone) throw new Error('Shipping zone was not found');
      const method = await manager.getRepository(ShippingMethod).save({
        zoneId,
        title: input.title.trim(),
        position: input.position ?? 0,
        active: input.active ?? true,
      });
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_METHOD_CREATED,
        'shipping_method',
        method.id,
        { zoneId },
      );
      return this.toMethod(method);
    });
  }

  async updateMethod(
    id: string,
    input: Partial<{ title: string; position: number; active: boolean }>,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    return this.transactions.run(async (transaction) => {
      const repository =
        unwrapTypeOrmTransaction(transaction).getRepository(ShippingMethod);
      const method = await repository.findOneBy({ id });
      if (!method) throw new Error('Shipping method was not found');
      if (input.title !== undefined) method.title = input.title.trim();
      if (input.position !== undefined) method.position = input.position;
      if (input.active !== undefined) method.active = input.active;
      const saved = await repository.save(method);
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_METHOD_UPDATED,
        'shipping_method',
        id,
        { zoneId: method.zoneId },
      );
      return this.toMethod(saved);
    });
  }

  async deleteMethod(
    id: string,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    await this.transactions.run(async (transaction) => {
      const repository =
        unwrapTypeOrmTransaction(transaction).getRepository(ShippingMethod);
      const method = await repository.findOneBy({ id });
      if (!method) throw new Error('Shipping method was not found');
      method.active = false;
      await repository.save(method);
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_METHOD_ARCHIVED,
        'shipping_method',
        id,
        { zoneId: method.zoneId },
      );
    });
  }

  async createRule(
    methodId: string,
    input: {
      minimumSubtotal: string;
      maximumSubtotal?: string | null;
      amount: string;
      currency: string;
      active?: boolean;
    },
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    const currency = input.currency.toUpperCase();
    const minimum = parseMoney(input.minimumSubtotal, currency).minorAmount;
    const maximum =
      input.maximumSubtotal == null
        ? null
        : parseMoney(input.maximumSubtotal, currency).minorAmount;
    const amount = parseMoney(input.amount, currency).minorAmount;
    if (maximum !== null && maximum <= minimum)
      throw new Error('Maximum subtotal must be above minimum subtotal');
    return this.transactions.run(async (transaction) => {
      const manager = unwrapTypeOrmTransaction(transaction);
      const method = await manager.getRepository(ShippingMethod).findOneBy({
        id: methodId,
      });
      if (!method) throw new Error('Shipping method was not found');
      if (input.active ?? true)
        await this.assertNoOverlap(
          manager,
          methodId,
          currency,
          minimum,
          maximum,
        );
      const rule = await manager.getRepository(ShippingRateRule).save({
        methodId,
        minimumSubtotal: minimum.toString(),
        maximumSubtotal: maximum?.toString() ?? null,
        minorAmount: amount.toString(),
        currency,
        active: input.active ?? true,
      });
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_RULE_CREATED,
        'shipping_rule',
        rule.id,
        { methodId, currency },
      );
      return this.toRule(rule);
    });
  }

  async updateRule(
    id: string,
    input: {
      minimumSubtotal: string;
      maximumSubtotal?: string | null;
      amount: string;
      currency: string;
      active?: boolean;
    },
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    const currency = input.currency.toUpperCase();
    const minimum = parseMoney(input.minimumSubtotal, currency).minorAmount;
    const maximum =
      input.maximumSubtotal == null
        ? null
        : parseMoney(input.maximumSubtotal, currency).minorAmount;
    if (maximum !== null && maximum <= minimum)
      throw new Error('Maximum subtotal must be above minimum subtotal');
    return this.transactions.run(async (transaction) => {
      const manager = unwrapTypeOrmTransaction(transaction);
      const repository = manager.getRepository(ShippingRateRule);
      const rule = await repository.findOneBy({ id });
      if (!rule) throw new Error('Shipping rate rule was not found');
      if (input.active ?? rule.active)
        await this.assertNoOverlap(
          manager,
          rule.methodId,
          currency,
          minimum,
          maximum,
          id,
        );
      rule.minimumSubtotal = minimum.toString();
      rule.maximumSubtotal = maximum?.toString() ?? null;
      rule.minorAmount = parseMoney(
        input.amount,
        currency,
      ).minorAmount.toString();
      rule.currency = currency;
      if (input.active !== undefined) rule.active = input.active;
      const saved = await repository.save(rule);
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_RULE_UPDATED,
        'shipping_rule',
        id,
        { methodId: rule.methodId, currency },
      );
      return this.toRule(saved);
    });
  }

  async deleteRule(
    id: string,
    actorUserId: string | null = null,
    requestId: string | null = null,
  ) {
    await this.transactions.run(async (transaction) => {
      const repository =
        unwrapTypeOrmTransaction(transaction).getRepository(ShippingRateRule);
      const rule = await repository.findOneBy({ id });
      if (!rule) throw new Error('Shipping rate rule was not found');
      rule.active = false;
      await repository.save(rule);
      await this.record(
        transaction,
        actorUserId,
        requestId,
        CommerceAuditAction.SHIPPING_RULE_ARCHIVED,
        'shipping_rule',
        id,
        { methodId: rule.methodId, currency: rule.currency },
      );
    });
  }

  async quote(
    address: DeliveryAddress,
    merchandiseSubtotal: { minorAmount: bigint; currency: string },
    transaction?: DatabaseTransactionContext,
  ): Promise<readonly ShippingQuote[]> {
    currencyScale(merchandiseSubtotal.currency);
    const manager = transaction
      ? unwrapTypeOrmTransaction(transaction)
      : this.dataSource.manager;
    const zones = await manager
      .getRepository(ShippingZone)
      .find({ where: { active: true } });
    const zone = zones
      .filter((candidate) => this.matches(candidate, address))
      .sort((a, b) => this.specificity(b) - this.specificity(a))[0];
    if (!zone) return [];
    const methods = await manager.getRepository(ShippingMethod).find({
      where: { zoneId: zone.id, active: true },
      order: { position: 'ASC', id: 'ASC' },
    });
    const rules = await manager
      .getRepository(ShippingRateRule)
      .find({ where: { active: true } });
    return methods.flatMap((method) => {
      const matching = rules.filter(
        (rule) =>
          rule.methodId === method.id &&
          rule.currency === merchandiseSubtotal.currency &&
          BigInt(rule.minimumSubtotal) <= merchandiseSubtotal.minorAmount &&
          (rule.maximumSubtotal === null ||
            merchandiseSubtotal.minorAmount < BigInt(rule.maximumSubtotal)),
      );
      if (matching.length !== 1) return [];
      const rule = matching[0];
      return [
        {
          zoneId: zone.id,
          methodId: method.id,
          methodTitle: method.title,
          ruleId: rule.id,
          charge: {
            minorAmount: BigInt(rule.minorAmount),
            currency: rule.currency,
          },
        },
      ];
    });
  }

  private matches(zone: ShippingZone, address: DeliveryAddress): boolean {
    return (
      zone.country.toUpperCase() === address.country.toUpperCase() &&
      (zone.province === null ||
        zone.province.toLowerCase() ===
          (address.province ?? '').toLowerCase()) &&
      (zone.city === null ||
        zone.city.toLowerCase() === address.city.toLowerCase()) &&
      (zone.postalPrefix === null ||
        address.postalCode.startsWith(zone.postalPrefix))
    );
  }

  private toZone(zone: ShippingZone) {
    return {
      id: zone.id,
      name: zone.name,
      country: zone.country,
      province: zone.province,
      city: zone.city,
      postalPrefix: zone.postalPrefix,
      active: zone.active,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
    };
  }

  private toMethod(method: ShippingMethod) {
    return {
      id: method.id,
      zoneId: method.zoneId,
      title: method.title,
      position: method.position,
      active: method.active,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  private toRule(rule: ShippingRateRule) {
    const minimum = formatMoney({
      minorAmount: BigInt(rule.minimumSubtotal),
      currency: rule.currency,
    });
    const maximum =
      rule.maximumSubtotal === null
        ? null
        : formatMoney({
            minorAmount: BigInt(rule.maximumSubtotal),
            currency: rule.currency,
          }).amount;
    const charge = formatMoney({
      minorAmount: BigInt(rule.minorAmount),
      currency: rule.currency,
    });
    return {
      id: rule.id,
      methodId: rule.methodId,
      minimumSubtotal: minimum.amount,
      maximumSubtotal: maximum,
      amount: charge.amount,
      currency: rule.currency,
      active: rule.active,
      createdAt: rule.createdAt,
    };
  }
  private specificity(zone: ShippingZone): number {
    return (
      Number(zone.province !== null) +
      Number(zone.city !== null) +
      Number(zone.postalPrefix !== null)
    );
  }

  private async assertNoOverlap(
    manager: EntityManager,
    methodId: string,
    currency: string,
    minimum: bigint,
    maximum: bigint | null,
    excludedId?: string,
  ) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `better-commerce:shipping-rate:${methodId}:${currency}`,
    ]);
    const existing = await manager.getRepository(ShippingRateRule).find({
      where: { methodId, currency, active: true },
      lock: { mode: 'pessimistic_write' },
    });
    const overlaps = existing.some((rule) => {
      if (rule.id === excludedId) return false;
      const otherMinimum = BigInt(rule.minimumSubtotal);
      const otherMaximum =
        rule.maximumSubtotal === null ? null : BigInt(rule.maximumSubtotal);
      return (
        (maximum === null || otherMinimum < maximum) &&
        (otherMaximum === null || minimum < otherMaximum)
      );
    });
    if (overlaps)
      throw new Error('Shipping rate range overlaps an active rule');
  }

  private record(
    transaction: DatabaseTransactionContext,
    actorUserId: string | null,
    requestId: string | null,
    action: CommerceAuditAction,
    targetType: string,
    targetId: string,
    metadata: CommerceAuditMetadata,
  ) {
    return this.audit.record(
      {
        actorUserId,
        action,
        targetType,
        targetId,
        requestId,
        metadata,
      },
      transaction,
    );
  }
}
