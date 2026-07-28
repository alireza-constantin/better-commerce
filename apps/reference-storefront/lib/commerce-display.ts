import type {
  StorefrontAvailability,
  StorefrontMoney,
  StorefrontPriceRange,
} from '@better-commerce/storefront-core';

export function displayMoney(money: StorefrontMoney): string {
  return money.currency === 'IRR'
    ? `${money.amount} ریال`
    : `${money.amount} ${money.currency}`;
}

export function displayPriceRange(
  range: StorefrontPriceRange | null,
): string {
  if (!range) return 'قیمت ثبت نشده است';
  if (!range.varies) return displayMoney(range.minimum);
  return `از ${displayMoney(range.minimum)} تا ${displayMoney(range.maximum)}`;
}

export function displayAvailability(
  availability: StorefrontAvailability,
): string {
  switch (availability) {
    case 'in_stock':
      return 'موجود';
    case 'out_of_stock':
      return 'ناموجود';
    case 'unavailable':
      return 'فعلاً قابل سفارش نیست';
  }
}
