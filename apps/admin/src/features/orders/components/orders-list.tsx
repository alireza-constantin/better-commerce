import { ChevronLeft, ChevronRight, PackageOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <section aria-labelledby="orders-list-heading" className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]" id="orders-list-heading">
            سفارش‌ها
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">فهرست سفارش‌های ثبت‌شده فروشگاه</p>
        </div>
        <p className="text-sm text-muted-foreground">{page.items.length.toLocaleString('fa-IR')} سفارش در این صفحه</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-180 text-right text-sm">
          <thead className="border-b border-border bg-muted/45 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">شماره</th>
              <th className="px-4 py-3 font-medium">زمان ثبت</th>
              <th className="px-4 py-3 font-medium">وضعیت سفارش</th>
              <th className="px-4 py-3 font-medium">پرداخت</th>
              <th className="px-4 py-3 font-medium">مبلغ کل</th>
              <th className="px-4 py-3"><span className="sr-only">مشاهده جزئیات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {page.items.map((order) => (
              <tr className="transition-colors hover:bg-muted/40" key={order.id}>
                <td className="px-4 py-3 font-medium"><bdi dir="ltr">#{order.orderNumber}</bdi></td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatOrderDate(order.submittedAt)}</td>
                <td className="px-4 py-3"><OrderStatusBadge label={orderStatusLabel(order.status)} status={order.status} /></td>
                <td className="px-4 py-3"><PaymentStatusBadge label={paymentStatusLabel(order.paymentStatus)} status={order.paymentStatus} /></td>
                <td className="whitespace-nowrap px-4 py-3 font-medium"><bdi dir="ltr">{formatExactMoney(order.grandTotal, order.currency)}</bdi></td>
                <td className="px-4 py-3 text-left">
                  <Button aria-label={`مشاهده سفارش ${order.orderNumber}`} onClick={() => onOrderSelect(order.id)} size="sm" variant="ghost">
                    جزئیات <ChevronLeft aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="صفحه‌بندی سفارش‌ها" className="flex items-center justify-between gap-3">
        <Button disabled={!hasPreviousPage || isFetchingPreviousPage} onClick={onPreviousPage} variant="outline">
          <ChevronRight aria-hidden="true" /> {isFetchingPreviousPage ? 'در حال دریافت…' : 'صفحه پیشین'}
        </Button>
        <Button disabled={!page.nextCursor || isFetchingNextPage} onClick={onNextPage} variant="outline">
          {isFetchingNextPage ? 'در حال دریافت…' : 'صفحه بعد'} <ChevronLeft aria-hidden="true" />
        </Button>
      </nav>
    </section>
  );
}

function OrdersListLoading() {
  return <section aria-busy="true" aria-label="در حال دریافت سفارش‌ها" className="space-y-4" dir="rtl"><div className="h-8 w-36 animate-pulse rounded bg-muted" /><div className="overflow-hidden rounded-lg border border-border bg-card"><div className="h-12 animate-pulse border-b border-border bg-muted/50" />{Array.from({ length: 5 }, (_, index) => <div className="h-16 animate-pulse border-b border-border last:border-b-0" key={index}><div className="mx-4 mt-5 h-4 w-2/3 rounded bg-muted" /></div>)}</div></section>;
}

function OrdersListEmpty() {
  return <section className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center" dir="rtl"><PackageOpen aria-hidden="true" className="size-8 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">هنوز سفارشی ثبت نشده است</h1><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">وقتی مشتری سفارشی ثبت کند، برای بررسی و انجام عملیات در این بخش نمایش داده می‌شود.</p></section>;
}

function OrdersListError({ error, onRetry }: { readonly error: string; readonly onRetry?: () => void }) {
  return <section className="rounded-lg border border-destructive/25 bg-card px-5 py-6" dir="rtl" role="alert"><h1 className="font-semibold">دریافت سفارش‌ها انجام نشد</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>{onRetry ? <Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button> : null}</section>;
}

export function OrderStatusBadge({ label, status }: { readonly label: string; readonly status: 'submitted' | 'accepted' | 'cancelled' | 'completed' }) {
  const tone = status === 'cancelled' ? 'bg-destructive/10 text-destructive' : status === 'completed' ? 'bg-emerald-700/10 text-emerald-800' : status === 'accepted' ? 'bg-sky-700/10 text-sky-800' : 'bg-amber-700/10 text-amber-900';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}

export function PaymentStatusBadge({ label, status }: { readonly label: string; readonly status: 'pending_manual_review' | 'pending_collection' | 'confirmed' | 'rejected' | 'cancelled' }) {
  const tone = status === 'confirmed' ? 'bg-emerald-700/10 text-emerald-800' : status === 'rejected' || status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 'bg-amber-700/10 text-amber-900';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}
