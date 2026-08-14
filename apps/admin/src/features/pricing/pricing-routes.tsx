import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, RefreshCw, Tag } from 'lucide-react';
import { isAdminApiError } from '@/api/client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field as FormField,
  FieldLabel,
  Input,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { ProductVariantPicker } from '@/features/catalog/components/product-variant-picker';
import { currentPriceQueryOptions, pricingQueryKeys, setCurrentPriceMutationOptions } from './api';

const MONEY_PATTERN = /^\d+(\.\d+)?$/;

export function PricingRoute() {
  return <PermissionBoundary required={adminRoutes.pricing.permissions}><PricingContent /></PermissionBoundary>;
}

function PricingContent() {
  const profile = useAdminSession();
  const queryClient = useQueryClient();
  const [variantId, setVariantId] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string>();
  const price = useQuery(currentPriceQueryOptions(variantId));
  const write = useMutation(setCurrentPriceMutationOptions());
  const canWrite = hasPermission(profile.permissions, 'pricing.write');

  const selectVariant = (nextVariantId: string) => {
    setVariantId(nextVariantId);
    setAmount('');
    setConfirmed(false);
    setFormError(undefined);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !variantId) return;
    if (!MONEY_PATTERN.test(amount.trim()) || Number(amount) <= 0) {
      setFormError('مبلغ را به‌صورت عدد اعشاری مثبت وارد کنید.');
      return;
    }
    if (!confirmed) {
      setFormError('برای ایجاد نسخه جدید قیمت، پیامد تغییر را تأیید کنید.');
      return;
    }
    setFormError(undefined);
    try {
      await write.mutateAsync({ variantId, amount: amount.trim() });
      await queryClient.invalidateQueries({ queryKey: pricingQueryKeys.current(variantId) });
      setAmount('');
      setConfirmed(false);
    } catch { /* The normalized problem is displayed below. */ }
  };

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4" dir="rtl">
      <header className="border-b border-border pb-4">
        <div className="flex items-center gap-2"><Tag aria-hidden="true" className="size-5 text-muted-foreground" /><h1 className="text-2xl font-semibold tracking-tight">قیمت‌گذاری</h1></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">کالا و گونه را انتخاب کنید. هر ثبت، نسخه‌ای جدید و قابل ممیزی از قیمت ایجاد می‌کند.</p>
      </header>
      <ProductVariantPicker onChange={selectVariant} value={variantId} />
      {formError ? <Problem message={formError} /> : null}
      {price.isError ? <Problem message={problemMessage(price.error, 'قیمت فعلی این گونه دریافت نشد. دوباره تلاش کنید.')} /> : null}
      {variantId && price.isPending ? <Card><CardContent className="space-y-3 py-5"><Skeleton className="h-5 w-32" /><Skeleton className="h-10" /></CardContent></Card> : null}
      {variantId && price.data ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>قیمت این گونه</CardTitle>
              <CardDescription><bdi dir="ltr">{variantId}</bdi></CardDescription>
            </div>
            {price.data.state === 'priced' ? (
              <div className="text-left"><p className="text-xl font-semibold"><bdi dir="ltr">{price.data.amount} {price.data.currency}</bdi></p><StatusBadge tone="success">قیمت‌دار</StatusBadge></div>
            ) : <StatusBadge tone="warning">قیمت درخواستی</StatusBadge>}
          </CardHeader>
          <CardContent>
            {canWrite ? (
              <form className="border-t border-border pt-5" onSubmit={(event) => { void submit(event); }}>
                <h2 className="font-semibold">{price.data.state === 'priced' ? 'ایجاد نسخه جدید قیمت' : 'ثبت اولین قیمت'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">عدد اعشاری را دقیق وارد کنید؛ مرورگر مقدار پول را محاسبه یا گرد نمی‌کند.</p>
                <FormField className="mt-4">
                  <FieldLabel htmlFor="pricing-amount">مبلغ جدید {price.data.currency ? `(${price.data.currency})` : ''}</FieldLabel>
                  <Input dir="ltr" id="pricing-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="120000.00" value={amount} />
                </FormField>
                <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm leading-6" htmlFor="confirm-price-change">
                  <Checkbox checked={confirmed} id="confirm-price-change" onCheckedChange={(value) => setConfirmed(value === true)} />
                  <span>می‌دانم این کار قیمت قبلی را ویرایش نمی‌کند و یک نسخه جدید قیمت ایجاد می‌کند.</span>
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button disabled={write.isPending || !confirmed} type="submit">{write.isPending ? 'در حال ثبت…' : 'ثبت نسخه قیمت'}</Button>
                  <Button disabled={price.isFetching} onClick={() => { void price.refetch(); }} type="button" variant="ghost"><RefreshCw aria-hidden="true" /> تازه‌سازی</Button>
                </div>
              </form>
            ) : <p className="border-t border-border pt-5 text-sm text-muted-foreground">برای ایجاد نسخه جدید قیمت، مجوز لازم را ندارید.</p>}
            {write.isError ? <div className="mt-4"><Problem message={problemMessage(write.error, 'نسخه جدید قیمت ثبت نشد. دوباره تلاش کنید.')} /></div> : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function Problem({ message }: { readonly message: string }) {
  return <div className="flex gap-2 rounded-lg bg-card px-4 py-3 text-sm ring-1 ring-destructive/25" role="alert"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" /><p>{message}</p></div>;
}

function problemMessage(error: unknown, fallback: string) {
  if (isAdminApiError(error) && error.problem.kind === 'api' && error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.';
  return fallback;
}
