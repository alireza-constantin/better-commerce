import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';

export type AdminOrder = BetterCommerceApiSchemas['OrderResponseDto'];
export type AdminOrdersPage = BetterCommerceApiSchemas['OrdersPageResponseDto'];
export type AdminOrderLine = BetterCommerceApiSchemas['OrderLineResponseDto'];

export function formatExactMoney(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

export function formatOrderDate(value: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function orderStatusLabel(status: AdminOrder['status']): string {
  return {
    submitted: 'ثبت‌شده',
    accepted: 'پذیرفته‌شده',
    cancelled: 'لغوشده',
    completed: 'تکمیل‌شده',
  }[status];
}

export function paymentStatusLabel(status: AdminOrder['paymentStatus']): string {
  return {
    pending_manual_review: 'در انتظار بررسی',
    pending_collection: 'در انتظار دریافت',
    confirmed: 'تأییدشده',
    rejected: 'ردشده',
    cancelled: 'لغوشده',
  }[status];
}

export function paymentMethodLabel(method: AdminOrder['paymentMethod']): string {
  return {
    cash_on_delivery: 'پرداخت هنگام تحویل',
    cash_on_pickup: 'پرداخت هنگام دریافت',
    bank_transfer: 'واریز بانکی',
  }[method];
}

export function fulfillmentLabel(
  classification: AdminOrderLine['fulfillmentClassification'],
): string {
  return {
    physical: 'فیزیکی',
    digital: 'دیجیتال',
    service: 'خدماتی',
  }[classification];
}
