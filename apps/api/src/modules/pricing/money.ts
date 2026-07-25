import type { Money } from './pricing.contract';

const CURRENCY_SCALES: Readonly<Record<string, number>> = Object.freeze({
  USD: 2,
  EUR: 2,
  GBP: 2,
  IRR: 0,
  JPY: 0,
  KWD: 3,
});

export function currencyScale(currency: string): number {
  const scale = CURRENCY_SCALES[currency.toUpperCase()];
  if (scale === undefined) throw new Error(`Unsupported currency ${currency}`);
  return scale;
}

export function parseMoney(amount: string, currency: string): Money {
  const normalizedCurrency = currency.toUpperCase();
  const scale = currencyScale(normalizedCurrency);
  if (!/^\d+(?:\.\d+)?$/.test(amount)) throw new Error('Invalid money amount');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > scale) throw new Error('Money amount exceeds currency scale');
  const minorAmount = BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
  return { minorAmount, currency: normalizedCurrency };
}

export function formatMoney(money: Money): { amount: string; currency: string } {
  const scale = currencyScale(money.currency);
  const raw = money.minorAmount.toString().padStart(scale + 1, '0');
  if (scale === 0) return { amount: raw, currency: money.currency };
  const amount = `${raw.slice(0, -scale)}.${raw.slice(-scale)}`;
  return { amount, currency: money.currency };
}
