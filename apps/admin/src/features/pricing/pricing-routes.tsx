import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, RefreshCw, Tag } from 'lucide-react';
import { isAdminApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { currentPriceQueryOptions, pricingQueryKeys, setCurrentPriceMutationOptions } from './api';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_PATTERN = /^\d+(\.\d+)?$/;

export function PricingRoute() {
  return <PermissionBoundary required={adminRoutes.pricing.permissions}><PricingContent /></PermissionBoundary>;
}

function PricingContent() {
  const profile = useAdminSession();
  const queryClient = useQueryClient();
  const [variantId, setVariantId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string>();
  const price = useQuery(currentPriceQueryOptions(lookupId));
  const write = useMutation(setCurrentPriceMutationOptions());
  const canWrite = hasPermission(profile.permissions, 'pricing.write');

  const lookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = variantId.trim();
    if (!UUID_PATTERN.test(normalized)) { setFormError('شناسه گونه باید یک UUID معتبر باشد.'); return; }
    setFormError(undefined); setLookupId(normalized); setAmount(''); setConfirmed(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    if (!MONEY_PATTERN.test(amount.trim()) || amount.trim() === '0') { setFormError('مبلغ را به‌صورت عدد اعشاری مثبت وارد کنید.'); return; }
    if (!confirmed) { setFormError('برای ایجاد نسخه جدید قیمت، تأیید را انتخاب کنید.'); return; }
    setFormError(undefined);
    try {
      await write.mutateAsync({ variantId: lookupId, amount: amount.trim() });
      await queryClient.invalidateQueries({ queryKey: pricingQueryKeys.current(lookupId) });
      setAmount(''); setConfirmed(false);
    } catch { /* The normalized problem is displayed below. */ }
  };

  return <section className="mx-auto max-w-3xl space-y-6" dir="rtl">
    <header><div className="flex items-center gap-2"><Tag className="size-5 text-muted-foreground" aria-hidden="true" /><h1 className="text-2xl font-semibold tracking-[-0.025em]">قیمت‌گذاری</h1></div><p className="mt-2 text-sm leading-6 text-muted-foreground">قیمت هر گونه را با شناسه آن بررسی کنید. ثبت قیمت، نسخه جدید ایجاد می‌کند و نسخه قبلی را تغییر نمی‌دهد.</p></header>
    <form className="rounded-lg border border-border bg-card p-5" onSubmit={lookup}><label className="block text-sm font-medium" htmlFor="pricing-variant">شناسه گونه کالا</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" id="pricing-variant" onChange={(event) => setVariantId(event.target.value)} placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx" value={variantId} /><Button type="submit" variant="outline">بررسی قیمت</Button></div><p className="mt-2 text-xs leading-5 text-muted-foreground">در این مرحله فهرست گونه‌ها از API موجود نیست؛ شناسه را از کاتالوگ وارد کنید.</p></form>
    {formError ? <Problem message={formError} /> : null}
    {price.isError ? <Problem message={problemMessage(price.error, 'قیمت فعلی این گونه پیدا نشد یا دسترسی آن وجود ندارد.')} /> : null}
    {lookupId && price.isPending ? <Loading /> : null}
    {price.data ? <div className="space-y-5 rounded-lg border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">قیمت فعلی</h2><p className="mt-1 text-sm text-muted-foreground">شناسه گونه: <bdi dir="ltr">{price.data.variantId}</bdi></p></div><div className="text-left"><p className="text-xl font-semibold"><bdi dir="ltr">{price.data.amount} {price.data.currency}</bdi></p><p className="mt-1 text-xs text-muted-foreground">نسخه: <bdi dir="ltr">{price.data.priceVersionId}</bdi></p></div></div>
      {canWrite ? <form className="border-t border-border pt-5" onSubmit={(event) => { void submit(event); }}><h2 className="font-semibold">ایجاد نسخه جدید</h2><label className="mt-4 block text-sm font-medium" htmlFor="pricing-amount">مبلغ جدید ({price.data.currency})<input className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" id="pricing-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="120000.00" value={amount} /></label><label className="mt-4 flex cursor-pointer items-start gap-2 text-sm leading-6"><input checked={confirmed} className="mt-1 size-4 accent-primary" onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span>می‌دانم این کار قیمت را ویرایش نمی‌کند و یک نسخه جدید قیمت ایجاد می‌کند.</span></label><div className="mt-4 flex flex-wrap gap-2"><Button disabled={write.isPending || !confirmed} type="submit">{write.isPending ? 'در حال ثبت…' : 'ایجاد نسخه قیمت'}</Button><Button disabled={price.isFetching} onClick={() => { void price.refetch(); }} type="button" variant="ghost"><RefreshCw aria-hidden="true" /> تازه‌سازی</Button></div></form> : <p className="border-t border-border pt-5 text-sm text-muted-foreground">برای ایجاد نسخه جدید قیمت، مجوز لازم را ندارید.</p>}
      {write.isError ? <div className="mt-4"><Problem message={problemMessage(write.error, 'نسخه جدید قیمت ثبت نشد. دوباره تلاش کنید.')} /></div> : null}
    </div> : null}
  </section>;
}

function Loading() { return <div aria-busy="true" aria-label="در حال دریافت قیمت" className="rounded-lg border border-border bg-card p-5"><div className="h-5 w-28 animate-pulse rounded bg-muted" /><div className="mt-5 h-10 animate-pulse rounded bg-muted" /></div>; }
function Problem({ message }: { readonly message: string }) { return <div className="flex gap-2 rounded-lg border border-destructive/25 bg-card px-4 py-3 text-sm" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><p>{message}</p></div>; }
function problemMessage(error: unknown, fallback: string) { if (isAdminApiError(error) && error.problem.kind === 'api' && error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.'; return fallback; }
