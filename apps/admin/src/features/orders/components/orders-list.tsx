import { ChevronLeft, ChevronRight, PackageOpen, RefreshCw } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
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
    <section className="mx-auto flex max-w-[90rem] flex-col gap-4" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">سفارش‌ها</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            سفارش‌های تازه و نیازمند اقدام را بررسی و برای پردازش باز کنید.
          </p>
        </div>
        <StatusBadge tone="neutral">
          {page.items.length.toLocaleString('fa-IR')} سفارش در این صفحه
        </StatusBadge>
      </header>

      <div className="grid gap-3 md:hidden">
        {page.items.map((order) => (
          <button
            aria-label={`مشاهده سفارش ${order.orderNumber}`}
            className="rounded-lg bg-card p-4 text-right outline-none ring-1 ring-foreground/10 transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"
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
            <div className="mt-3 flex flex-wrap gap-2">
              <OrderStatusBadge label={orderStatusLabel(order.status)} status={order.status} />
              <PaymentStatusBadge label={paymentStatusLabel(order.paymentStatus)} status={order.paymentStatus} />
            </div>
            <p className="mt-3 border-t border-border pt-3 font-semibold" dir="ltr">
              {formatExactMoney(order.grandTotal, order.currency)}
            </p>
          </button>
        ))}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableCaption className="sr-only">فهرست سفارش‌های ثبت‌شده فروشگاه</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">شماره سفارش</TableHead>
                <TableHead scope="col">زمان ثبت</TableHead>
                <TableHead scope="col">وضعیت سفارش</TableHead>
                <TableHead scope="col">پرداخت</TableHead>
                <TableHead scope="col">مبلغ کل</TableHead>
                <TableHead scope="col"><span className="sr-only">عملیات</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium" dir="ltr">#{order.orderNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatOrderDate(order.submittedAt)}</TableCell>
                  <TableCell><OrderStatusBadge label={orderStatusLabel(order.status)} status={order.status} /></TableCell>
                  <TableCell><PaymentStatusBadge label={paymentStatusLabel(order.paymentStatus)} status={order.paymentStatus} /></TableCell>
                  <TableCell className="whitespace-nowrap font-medium" dir="ltr">{formatExactMoney(order.grandTotal, order.currency)}</TableCell>
                  <TableCell className="text-left">
                    <Button aria-label={`مشاهده سفارش ${order.orderNumber}`} onClick={() => onOrderSelect(order.id)} size="sm" variant="ghost">
                      جزئیات <ChevronLeft aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
  return (
    <section aria-busy="true" aria-label="در حال دریافت سفارش‌ها" className="space-y-4" dir="rtl">
      <Skeleton className="h-9 w-40" />
      {Array.from({ length: 5 }, (_, index) => <Skeleton className="h-16 rounded-lg" key={index} />)}
    </section>
  );
}

function OrdersListEmpty() {
  return (
    <Empty className="min-h-72 border border-dashed bg-card" dir="rtl">
      <EmptyHeader>
        <EmptyMedia variant="icon"><PackageOpen aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>هنوز سفارشی ثبت نشده است</EmptyTitle>
        <EmptyDescription>وقتی مشتری سفارشی ثبت کند، برای بررسی و انجام عملیات در این بخش نمایش داده می‌شود.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function OrdersListError({ error, onRetry }: { readonly error: string; readonly onRetry?: () => void }) {
  return (
    <Card dir="rtl" role="alert">
      <CardContent className="py-6">
        <h1 className="font-semibold">دریافت سفارش‌ها انجام نشد</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
        {onRetry ? <Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button> : null}
      </CardContent>
    </Card>
  );
}

export function OrderStatusBadge({ label, status }: { readonly label: string; readonly status: 'submitted' | 'accepted' | 'cancelled' | 'completed' }) {
  const tone = status === 'cancelled' ? 'destructive' : status === 'completed' ? 'success' : status === 'accepted' ? 'info' : 'warning';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

export function PaymentStatusBadge({ label, status }: { readonly label: string; readonly status: 'pending_manual_review' | 'pending_collection' | 'confirmed' | 'rejected' | 'cancelled' }) {
  const tone = status === 'confirmed' ? 'success' : status === 'rejected' || status === 'cancelled' ? 'destructive' : 'warning';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
