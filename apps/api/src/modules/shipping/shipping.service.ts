import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { currencyScale } from '../pricing/money';
import type { DeliveryAddress, ShippingModuleContract, ShippingQuote } from './shipping.contract';
import { ShippingMethod } from './shipping-method.entity';
import { ShippingRateRule } from './shipping-rate-rule.entity';
import { ShippingZone } from './shipping-zone.entity';

@Injectable()
export class ShippingService implements ShippingModuleContract {
  constructor(private readonly dataSource: DataSource) {}

  async quote(address: DeliveryAddress, merchandiseSubtotal: { minorAmount: bigint; currency: string }): Promise<readonly ShippingQuote[]> {
    currencyScale(merchandiseSubtotal.currency);
    const zones = await this.dataSource.getRepository(ShippingZone).find({ where: { active: true } });
    const zone = zones
      .filter((candidate) => this.matches(candidate, address))
      .sort((a, b) => this.specificity(b) - this.specificity(a))[0];
    if (!zone) return [];
    const methods = await this.dataSource.getRepository(ShippingMethod).find({
      where: { zoneId: zone.id, active: true }, order: { position: 'ASC', id: 'ASC' },
    });
    const rules = await this.dataSource.getRepository(ShippingRateRule).find({ where: { active: true } });
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
}
