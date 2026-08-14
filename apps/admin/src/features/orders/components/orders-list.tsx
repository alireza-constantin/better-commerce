import { ChevronLeft, ChevronRight, PackageOpen, RefreshCw } from 'lucide-react';
import { Button, PageHeader, StatusBadge } from '@/components/ui';
import {
  formatExactMoney,
  formatOrderDate,
  orderStatusLabel,
  paymentStatusLabel,
  type AdminOrdersPage,
} from './order-presenters';

export interface OrdersListProps {
  readonly page?: AdminOrdersPage;
  readonly isLoading?: boolean;
  readonly error?: string;
  readonly isFetchingNextPage?: boolean;
  readonly isFetchingPreviousPage?: boolean;
  readonly hasPreviousPage?: boolean;
  readonly onOrderSelect: (orderId: string) => void;
  readonly onNextPage?: () => void;
  readonly onPreviousPage?: () => void;
  readonly onRetry?: () => void;
}

export function OrdersList({
  error,
  hasPreviousPage = false,
  isFetchingNextPage = false,
  isFetchingPreviousPage = false,
  isLoading = false,
  onNextPage,
  onOrderSelect,
  onPreviousPage,
  onRetry,
  page,
}: OrdersListProps) {
  if (isLoading) return <OrdersListLoading />;
  if (error) return <OrdersListError error={error} onRetry={onRetry} />;
  if (!page || page.items.length === 0) return <OrdersListEmpty />;

  return (
    <section aria-labelledby="orders-list-heading" className="space-y-5" dir="rtl">
      <PageHeader
        description="سفارش‌های تازه و نیازمند اقدام را بررسی و برای پردازش باز کنید."
        eyebrow={`${page.items.length.toLocaleString('fa-IR')} سفارش در این صفحه`}
        title={<span id="orders-list-heading">سفارش‌ها</span>}
      />

      <div className="grid gap-3 md:hidden">
        {page.items.map((order) => (
          <button
            aria-label={`مشاهده سفارش ${order.orderNumber}`}
            className="rounded-2xl border border-border bg-card p-4 text-right shadow-xs outline-none transition hover:border-primary/30 focus-visible:ring-3 focus-visible:ring-primary/15"
            key={order.id}
            onClick={() => onOrderSelect(order.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold" dir="ltr">#{order.orderNumber}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatOrderDate(order.submittedAt)}</p>
              </div>
              <ChevronLeft aria-hidden="true" className="size-5 text-muted-foreground" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <OrderStatusBadge label={orderStatusLabel(order.status)} status={order.status} />
              <PaymentStatusBadge label={paymentStatusLabel(order.paymentStatus)} status={order.paymentStatus} />
            </div>
            <p className="mt-4 border-t border-border pt-3 font-semibold" dir="ltr">{formatExactMoney(order.grandTotal, order.currency)}</p>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-xs md:block">
        <table className="w-full min-w-180 text-right text-sm">
          <caption className="sr-only">فهرست سفارش‌های ثبت‌شده فروشگاه</caption>
          <thead className="border-b border-border bg-muted/45 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium" scope="col">شماره</th>
              <th className="px-4 py-3 font-medium" scope="col">زمان ثبت</th>
              <th className="px-4 py-3 font-medium" scope="col">وضعیت سفارش</th>
              <th className="px-4 py-3 font-medium" scope="col">پرداخت</th>
              <th className="px-4 py-3 font-medium" scope="col">مبلغ کل</th>
              <th className="px-4 py-3" scope="col"><span className="sr-only">مشاهده</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {page.items.map((order) => (
              <tr className="transition-colors hover:bg-muted/40" key={order.id}>
                <td className="px-4 py-3 font-medium" dir="ltr">#{order.orderNumber}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatOrderDate(order.submittedAt)}</td>
                <td className="px-4 py-3"><OrderStatusBadge label={orderStatusLabel(order.status)} status={order.status} /></td>
                <td className="px-4 py-3"><PaymentStatusBadge label={paymentStatusLabel(order.paymentStatus)} status={order.paymentStatus} /></td>
                <td className="whitespace-nowrap px-4 py-3 font-medium" dir="ltr">{formatExactMoney(order.grandTotal, order.currency)}</td>
                <td className="px-4 py-3 text-left"><Button aria-label={`مشاهده سفارش ${order.orderNumber}`} onClick={() => onOrderSelect(order.id)} size="sm" variant="ghost">جزئیات <ChevronLeft /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="صفحه‌بندی سفارش‌ها" className="flex items-center justify-between gap-3">
        <Button disabled={!hasPreviousPage || isFetchingPreviousPage} onClick={onPreviousPage} variant="outline"><ChevronRight /> {isFetchingPreviousPage ? 'در حال دریافت…' : 'صفحه پیشین'}</Button>
        <Button disabled={!page.nextCursor || isFetchingNextPage} onClick={onNextPage} variant="outline">{isFetchingNextPage ? 'در حال دریافت…' : 'صفحه بعد'} <ChevronLeft /></Button>
      </nav>
    </section>
  );
}

function OrdersListLoading() {
  return <section aria-busy="true" aria-label="در حال دریافت سفارش‌ها" className="space-y-4" dir="rtl"><div className="h-9 w-40 animate-pulse rounded bg-muted" />{Array.from({ length: 5 }, (_, index) => <div className="h-20 animate-pulse rounded-2xl bg-muted" key={index} />)}</section>;
}

function OrdersListEmpty() {
  return <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 text-center" dir="rtl"><PackageOpen className="size-9 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">هنوز سفارشی ثبت نشده است</h1><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">وقتی مشتری سفارشی ثبت کند، برای بررسی و انجام عملیات در این بخش نمایش داده می‌شود.</p></section>;
}

function OrdersListError({ error, onRetry }: { readonly error: string; readonly onRetry?: () => void }) {
  return <section className="rounded-2xl border border-destructive/25 bg-card px-5 py-6" dir="rtl" role="alert"><h1 className="font-semibold">دریافت سفارش‌ها انجام نشد</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>{onRetry ? <Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw /> تلاش دوباره</Button> : null}</section>;
}

export function OrderStatusBadge({ label, status }: { readonly label: string; readonly status: 'submitted' | 'accepted' | 'cancelled' | 'completed' }) {
  const tone = status === 'cancelled' ? 'destructive' : status === 'completed' ? 'success' : status === 'accepted' ? 'info' : 'warning';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

export function PaymentStatusBadge({ label, status }: { readonly label: string; readonly status: 'pending_manual_review' | 'pending_collection' | 'confirmed' | 'rejected' | 'cancelled' }) {
  const tone = status === 'confirmed' ? 'success' : status === 'rejected' || status === 'cancelled' ? 'destructive' : 'warning';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
