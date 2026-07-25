import type { Money } from '../pricing';

export const SHIPPING_MODULE_CONTRACT = Symbol('shipping-module-contract');

export interface DeliveryAddress {
  readonly recipientName: string;
  readonly phone: string;
  readonly country: string;
  readonly province?: string | null;
  readonly city: string;
  readonly line1: string;
  readonly line2?: string | null;
  readonly postalCode: string;
}

export interface ShippingQuote {
  readonly zoneId: string;
  readonly methodId: string;
  readonly methodTitle: string;
  readonly ruleId: string;
  readonly charge: Money;
}

export interface ShippingModuleContract {
  quote(address: DeliveryAddress, merchandiseSubtotal: Money): Promise<readonly ShippingQuote[]>;
}
