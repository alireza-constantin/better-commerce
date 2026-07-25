import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DatabaseTransactionContext } from '../../platform/database';
import { unwrapTypeOrmTransaction } from '../../platform/database/typeorm-transaction-context';
import { currencyScale } from '../pricing';
import { parseMoney } from '../pricing';
import type { DeliveryAddress, ShippingModuleContract, ShippingQuote } from './shipping.contract';
import { ShippingMethod } from './shipping-method.entity';
import { ShippingRateRule } from './shipping-rate-rule.entity';
import { ShippingZone } from './shipping-zone.entity';

@Injectable()
export class ShippingService implements ShippingModuleContract {
  constructor(private readonly dataSource: DataSource) {}

  async listConfiguration() {
    const [zones, methods, rules] = await Promise.all([
      this.dataSource.getRepository(ShippingZone).find({ order: { name: 'ASC' } }),
      this.dataSource.getRepository(ShippingMethod).find({ order: { position: 'ASC' } }),
      this.dataSource.getRepository(ShippingRateRule).find({ order: { minimumSubtotal: 'ASC' } }),
    ]);
    return { zones, methods, rules };
  }

  createZone(input: {
    name: string;
    country: string;
    province?: string;
    city?: string;
    postalPrefix?: string;
    active?: boolean;
  }) {
    return this.dataSource.getRepository(ShippingZone).save({
      name: input.name.trim(),
      country: input.country.toUpperCase(),
      province: input.province?.trim() || null,
      city: input.city?.trim() || null,
      postalPrefix: input.postalPrefix?.trim() || null,
      active: input.active ?? true,
    });
  }

  async updateZone(id: string, input: Partial<{
    name: string;
    country: string;
    province: string | null;
    city: string | null;
    postalPrefix: string | null;
    active: boolean;
  }>) {
    const repository = this.dataSource.getRepository(ShippingZone);
    const zone = await repository.findOneBy({ id });
    if (!zone) throw new Error('Shipping zone was not found');
    if (input.name !== undefined) zone.name = input.name.trim();
    if (input.country !== undefined) zone.country = input.country.toUpperCase();
    if (input.province !== undefined) zone.province = input.province?.trim() || null;
    if (input.city !== undefined) zone.city = input.city?.trim() || null;
    if (input.postalPrefix !== undefined) zone.postalPrefix = input.postalPrefix?.trim() || null;
    if (input.active !== undefined) zone.active = input.active;
    return repository.save(zone);
  }

  async deleteZone(id: string) {
    const repository = this.dataSource.getRepository(ShippingZone);
    const zone = await repository.findOneBy({ id });
    if (!zone) throw new Error('Shipping zone was not found');
    zone.active = false;
    await repository.save(zone);
  }

  async createMethod(zoneId: string, input: { title: string; position?: number; active?: boolean }) {
    const zone = await this.dataSource.getRepository(ShippingZone).findOneBy({ id: zoneId });
    if (!zone) throw new Error('Shipping zone was not found');
    return this.dataSource.getRepository(ShippingMethod).save({
      zoneId,
      title: input.title.trim(),
      position: input.position ?? 0,
      active: input.active ?? true,
    });
  }

  async updateMethod(id: string, input: Partial<{ title: string; position: number; active: boolean }>) {
    const repository = this.dataSource.getRepository(ShippingMethod);
    const method = await repository.findOneBy({ id });
    if (!method) throw new Error('Shipping method was not found');
    if (input.title !== undefined) method.title = input.title.trim();
    if (input.position !== undefined) method.position = input.position;
    if (input.active !== undefined) method.active = input.active;
    return repository.save(method);
  }

  async deleteMethod(id: string) {
    const repository = this.dataSource.getRepository(ShippingMethod);
    const method = await repository.findOneBy({ id });
    if (!method) throw new Error('Shipping method was not found');
    method.active = false;
    await repository.save(method);
  }

  async createRule(methodId: string, input: {
    minimumSubtotal: string;
    maximumSubtotal?: string | null;
    amount: string;
    currency: string;
    active?: boolean;
  }) {
    const method = await this.dataSource.getRepository(ShippingMethod).findOneBy({ id: methodId });
    if (!method) throw new Error('Shipping method was not found');
    const currency = input.currency.toUpperCase();
    const minimum = parseMoney(input.minimumSubtotal, currency).minorAmount;
    const maximum = input.maximumSubtotal == null
      ? null
      : parseMoney(input.maximumSubtotal, currency).minorAmount;
    const amount = parseMoney(input.amount, currency).minorAmount;
    if (maximum !== null && maximum <= minimum)
      throw new Error('Maximum subtotal must be above minimum subtotal');
    if (input.active ?? true)
      await this.assertNoOverlap(methodId, currency, minimum, maximum);
    return this.dataSource.getRepository(ShippingRateRule).save({
      methodId,
      minimumSubtotal: minimum.toString(),
      maximumSubtotal: maximum?.toString() ?? null,
      minorAmount: amount.toString(),
      currency,
      active: input.active ?? true,
    });
  }

  async updateRule(id: string, input: {
    minimumSubtotal: string;
    maximumSubtotal?: string | null;
    amount: string;
    currency: string;
    active?: boolean;
  }) {
    const repository = this.dataSource.getRepository(ShippingRateRule);
    const rule = await repository.findOneBy({ id });
    if (!rule) throw new Error('Shipping rate rule was not found');
    const currency = input.currency.toUpperCase();
    const minimum = parseMoney(input.minimumSubtotal, currency).minorAmount;
    const maximum = input.maximumSubtotal == null
      ? null
      : parseMoney(input.maximumSubtotal, currency).minorAmount;
    if (maximum !== null && maximum <= minimum)
      throw new Error('Maximum subtotal must be above minimum subtotal');
    if (input.active ?? rule.active)
      await this.assertNoOverlap(rule.methodId, currency, minimum, maximum, id);
    rule.minimumSubtotal = minimum.toString();
    rule.maximumSubtotal = maximum?.toString() ?? null;
    rule.minorAmount = parseMoney(input.amount, currency).minorAmount.toString();
    rule.currency = currency;
    if (input.active !== undefined) rule.active = input.active;
    return repository.save(rule);
  }

  async deleteRule(id: string) {
    const repository = this.dataSource.getRepository(ShippingRateRule);
    const rule = await repository.findOneBy({ id });
    if (!rule) throw new Error('Shipping rate rule was not found');
    rule.active = false;
    await repository.save(rule);
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
    const zones = await manager.getRepository(ShippingZone).find({ where: { active: true } });
    const zone = zones
      .filter((candidate) => this.matches(candidate, address))
      .sort((a, b) => this.specificity(b) - this.specificity(a))[0];
    if (!zone) return [];
    const methods = await manager.getRepository(ShippingMethod).find({
      where: { zoneId: zone.id, active: true }, order: { position: 'ASC', id: 'ASC' },
    });
    const rules = await manager.getRepository(ShippingRateRule).find({ where: { active: true } });
    return methods.flatMap((method) => {
      const matching = rules.filter((rule) =>
        rule.methodId === method.id && rule.currency === merchandiseSubtotal.currency &&
        BigInt(rule.minimumSubtotal) <= merchandiseSubtotal.minorAmount &&
        (rule.maximumSubtotal === null || merchandiseSubtotal.minorAmount < BigInt(rule.maximumSubtotal)),
      );
      if (matching.length !== 1) return [];
      const rule = matching[0];
      return [{
        zoneId: zone.id,
        methodId: method.id,
        methodTitle: method.title,
        ruleId: rule.id,
        charge: { minorAmount: BigInt(rule.minorAmount), currency: rule.currency },
      }];
    });
  }

  private matches(zone: ShippingZone, address: DeliveryAddress): boolean {
    return zone.country.toUpperCase() === address.country.toUpperCase() &&
      (zone.province === null || zone.province.toLowerCase() === (address.province ?? '').toLowerCase()) &&
      (zone.city === null || zone.city.toLowerCase() === address.city.toLowerCase()) &&
      (zone.postalPrefix === null || address.postalCode.startsWith(zone.postalPrefix));
  }
  private specificity(zone: ShippingZone): number {
    return Number(zone.province !== null) + Number(zone.city !== null) + Number(zone.postalPrefix !== null);
  }

  private async assertNoOverlap(
    methodId: string,
    currency: string,
    minimum: bigint,
    maximum: bigint | null,
    excludedId?: string,
  ) {
    const existing = await this.dataSource.getRepository(ShippingRateRule).find({
      where: { methodId, currency, active: true },
    });
    const overlaps = existing.some((rule) => {
      if (rule.id === excludedId) return false;
      const otherMinimum = BigInt(rule.minimumSubtotal);
      const otherMaximum = rule.maximumSubtotal === null ? null : BigInt(rule.maximumSubtotal);
      return (maximum === null || otherMinimum < maximum) &&
        (otherMaximum === null || minimum < otherMaximum);
    });
    if (overlaps) throw new Error('Shipping rate range overlaps an active rule');
  }
}
