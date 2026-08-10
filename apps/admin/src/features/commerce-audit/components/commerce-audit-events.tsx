import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommerceAuditEvent, CommerceAuditPage } from '../api';

export interface CommerceAuditEventsProps {
  readonly page?: CommerceAuditPage;
  readonly heading?: string;
  readonly description?: string;
  readonly emptyTitle?: string;
  readonly isLoading?: boolean;
  readonly isFetching?: boolean;
  readonly hasPreviousPage?: boolean;
  readonly error?: string;
  readonly onNextPage?: () => void;
  readonly onPreviousPage?: () => void;
  readonly onRetry?: () => void;
}

const actionLabels: Partial<Record<CommerceAuditEvent['action'], string>> = {
  'pricing.price_changed': 'تغییر قیمت',
  'inventory.configured': 'پیکربندی موجودی',
  'inventory.adjusted': 'اصلاح موجودی',
  'shipping.zone_created': 'ایجاد منطقه ارسال',
  'shipping.zone_updated': 'ویرایش منطقه ارسال',
  'shipping.zone_archived': 'بایگانی منطقه ارسال',
  'shipping.method_created': 'ایجاد روش ارسال',
  'shipping.method_updated': 'ویرایش روش ارسال',
  'shipping.method_archived': 'بایگانی روش ارسال',
  'shipping.rule_created': 'ایجاد قانون ارسال',
  'shipping.rule_updated': 'ویرایش قانون ارسال',
  'shipping.rule_archived': 'بایگانی قانون ارسال',
  'orders.submitted': 'ثبت سفارش',
  'orders.accepted': 'پذیرش سفارش',
  'orders.rejected': 'رد سفارش',
  'payments.confirmed': 'تأیید پرداخت',
};

export function CommerceAuditEvents({
  error,
  hasPreviousPage = false,
  isFetching = false,
  isLoading = false,
  onNextPage,
  onPreviousPage,
  onRetry,
  page,
  heading,
  description,
  emptyTitle,
}: CommerceAuditEventsProps) {
  const resolvedHeading = heading ?? 'فعالیت فروشگاه';
  const resolvedDescription = description ?? 'رویدادهای ثبت‌شده عملیات مهم فروشگاه، از جدیدترین به قدیمی‌ترین.';
  const resolvedEmptyTitle = emptyTitle ?? 'هنوز رویدادی ثبت نشده است';
  if (isLoading) return <CommerceAuditLoading />;
  if (error) return <CommerceAuditError error={error} onRetry={onRetry} />;
  if (!page || page.items.length === 0) return <CommerceAuditEmpty title={resolvedEmptyTitle} />;

  return (
    <section aria-labelledby="commerce-audit-heading" className="space-y-4" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]" id="commerce-audit-heading">
            {resolvedHeading}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {resolvedDescription}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {page.items.length.toLocaleString('fa-IR')} رویداد در این صفحه
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-220 text-right text-sm">
          <thead className="border-b border-border bg-muted/45 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">رویداد</th>
              <th className="px-4 py-3 font-medium">زمان دقیق</th>
              <th className="px-4 py-3 font-medium">نوع هدف</th>
              <th className="px-4 py-3 font-medium">شناسه هدف</th>
              <th className="px-4 py-3 font-medium">عامل</th>
              <th className="px-4 py-3"><span className="sr-only">جزئیات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {page.items.map((event) => <CommerceAuditEventRow event={event} key={event.id} />)}
          </tbody>
        </table>
      </div>

      <nav aria-label="صفحه‌بندی ممیزی فروشگاه" className="flex items-center justify-between gap-3">
        <Button disabled={!hasPreviousPage || isFetching} onClick={onPreviousPage} variant="outline">
          <ChevronRight aria-hidden="true" /> {isFetching ? 'در حال دریافت…' : 'صفحه پیشین'}
        </Button>
        <Button disabled={!page.nextCursor || isFetching} onClick={onNextPage} variant="outline">
          {isFetching ? 'در حال دریافت…' : 'صفحه بعد'} <ChevronLeft aria-hidden="true" />
        </Button>
      </nav>
    </section>
  );
}

function CommerceAuditEventRow({ event }: { readonly event: CommerceAuditEvent }) {
  const actionLabel = actionLabels[event.action];

  return (
    <tr className="align-top transition-colors hover:bg-muted/40">
      <td className="px-4 py-3 font-medium">{actionLabel ?? <bdi dir="ltr">{event.action}</bdi>}</td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        <time dateTime={event.createdAt} title={toIso(event.createdAt)}>{formatExactDate(event.createdAt)}</time>
      </td>
      <td className="px-4 py-3"><TechnicalValue value={event.targetType} /></td>
      <td className="px-4 py-3"><TechnicalValue value={event.targetId} /></td>
      <td className="px-4 py-3"><TechnicalValue emptyLabel="سامانه" value={event.actorUserId} /></td>
      <td className="px-4 py-3 text-left">
        <details className="min-w-80 text-right">
          <summary className="cursor-pointer text-sm text-primary underline-offset-4 hover:underline">جزئیات</summary>
          <CommerceAuditDetail event={event} />
        </details>
      </td>
    </tr>
  );
}

function CommerceAuditDetail({ event }: { readonly event: CommerceAuditEvent }) {
  return (
    <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/25 p-3 text-sm shadow-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="شناسه رویداد" value={event.id} technical />
        <Detail label="شناسه درخواست" value={event.requestId} technical emptyLabel="ثبت نشده" />
        <Detail label="نوع هدف" value={event.targetType} technical />
        <Detail label="شناسه هدف" value={event.targetId} technical />
        <Detail label="عامل" value={event.actorUserId} technical emptyLabel="سامانه" />
        <Detail label="زمان دقیق" value={formatExactDate(event.createdAt)} />
      </dl>
      <div>
        <p className="text-xs font-medium text-muted-foreground">فراداده</p>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-background p-3 text-left text-xs leading-6" dir="ltr">
          {safeJson(event.metadata)}
        </pre>
      </div>
    </div>
  );
}

function Detail({ emptyLabel = '—', label, technical = false, value }: {
  readonly label: string;
  readonly value: string | null;
  readonly technical?: boolean;
  readonly emptyLabel?: string;
}) {
  const content = value ?? emptyLabel;
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-medium">{technical && value ? <bdi dir="ltr">{content}</bdi> : content}</dd></div>;
}

function TechnicalValue({ emptyLabel = '—', value }: { readonly value: string | null; readonly emptyLabel?: string }) {
  return value ? <bdi className="break-all" dir="ltr">{value}</bdi> : <span className="text-muted-foreground">{emptyLabel}</span>;
}

function CommerceAuditLoading() {
  return <section aria-busy="true" aria-label="در حال دریافت رویدادهای ممیزی فروشگاه" className="space-y-4" dir="rtl"><div className="h-8 w-40 animate-pulse rounded bg-muted" /><div className="overflow-hidden rounded-lg border border-border bg-card"><div className="h-12 animate-pulse border-b border-border bg-muted/50" />{Array.from({ length: 5 }, (_, index) => <div className="h-16 animate-pulse border-b border-border last:border-b-0" key={index}><div className="mx-4 mt-5 h-4 w-2/3 rounded bg-muted" /></div>)}</div></section>;
}

function CommerceAuditEmpty({ title }: { readonly title: string }) {
  return <section className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center" dir="rtl"><ClipboardList aria-hidden="true" className="size-8 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">{title}</h1><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">پس از انجام عملیات فروشگاه، رویدادهای مربوط در این بخش نمایش داده می‌شوند.</p></section>;
}

function CommerceAuditError({ error, onRetry }: { readonly error: string; readonly onRetry?: () => void }) {
  return <section className="rounded-lg border border-destructive/25 bg-card px-5 py-6" dir="rtl" role="alert"><h1 className="font-semibold">دریافت رویدادهای ممیزی انجام نشد</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>{onRetry ? <Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button> : null}</section>;
}

function formatExactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

function toIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return 'null';
  }
}
