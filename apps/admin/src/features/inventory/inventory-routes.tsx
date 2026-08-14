import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, Boxes, RefreshCw } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  Textarea,
} from '@/components/ui';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { ProductVariantPicker } from '@/features/catalog/components/product-variant-picker';
import {
  adjustInventory,
  configureInventory,
  listCurrentInventory,
  type Inventory,
} from './api/inventory-api';

const INTEGER_PATTERN = /^-?\d+$/;

export function InventoryRoute() {
  return <PermissionBoundary required={adminRoutes.inventory.permissions}><InventoryContent /></PermissionBoundary>;
}

function InventoryContent() {
  const profile = useAdminSession();
  const [variantId, setVariantId] = useState('');
  const [trackingMode, setTrackingMode] = useState<'tracked' | 'untracked'>('tracked');
  const [initialOnHand, setInitialOnHand] = useState('0');
  const [configurationConfirmed, setConfigurationConfirmed] = useState(false);
  const [delta, setDelta] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<Inventory>();
  const [formError, setFormError] = useState<string>();
  const canAdjust = hasPermission(profile.permissions, 'inventory.adjust');
  const current = useQuery({
    queryKey: ['admin', 'inventory', 'current', variantId],
    queryFn: async () => (await listCurrentInventory([variantId]))[0],
    enabled: Boolean(variantId),
  });
  const configure = useMutation({ mutationFn: configureInventory });
  const adjust = useMutation({ mutationFn: adjustInventory });
  const submitting = configure.isPending || adjust.isPending;

  const selectVariant = (nextVariantId: string) => {
    setVariantId(nextVariantId);
    setResult(undefined);
    setFormError(undefined);
    setConfigurationConfirmed(false);
    setConfirmed(false);
  };
  const refresh = async () => { await current.refetch(); };
  const configureSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!variantId || !canAdjust) return;
    if (!/^\d+$/.test(initialOnHand) || !Number.isSafeInteger(Number(initialOnHand))) {
      setFormError('موجودی اولیه باید یک عدد صحیح صفر یا بیشتر باشد.');
      return;
    }
    if (!configurationConfirmed) {
      setFormError('برای ثبت پیکربندی موجودی، پیامد تغییر را تأیید کنید.');
      return;
    }
    setFormError(undefined);
    try {
      setResult(await configure.mutateAsync({ variantId, data: { trackingMode, initialOnHand: Number(initialOnHand) } }));
      setConfigurationConfirmed(false);
      await refresh();
    } catch { /* The normalized problem is displayed below. */ }
  };
  const adjustmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!variantId || !canAdjust) return;
    if (!INTEGER_PATTERN.test(delta) || Number(delta) === 0 || !Number.isSafeInteger(Number(delta))) {
      setFormError('تغییر موجودی باید یک عدد صحیح غیرصفر باشد.');
      return;
    }
    if (!reasonCode.trim() || reasonCode.trim().length > 80) {
      setFormError('دلیل تغییر را وارد کنید؛ حداکثر ۸۰ نویسه.');
      return;
    }
    if (!confirmed) {
      setFormError('برای ثبت تغییر موجودی، پیامد تغییر را تأیید کنید.');
      return;
    }
    setFormError(undefined);
    try {
      setResult(await adjust.mutateAsync({ variantId, data: { delta: Number(delta), reasonCode: reasonCode.trim(), note: note.trim() || undefined } }));
      setDelta(''); setReasonCode(''); setNote(''); setConfirmed(false);
      await refresh();
    } catch { /* The normalized problem is displayed below. */ }
  };
  const mutationError = configure.error ?? adjust.error;
  const displayed = result ?? current.data;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4" dir="rtl">
      <header className="border-b border-border pb-4">
        <div className="flex items-center gap-2"><Boxes aria-hidden="true" className="size-5 text-muted-foreground" /><h1 className="text-2xl font-semibold tracking-tight">موجودی</h1></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">کالا و گونه را انتخاب کنید؛ وضعیت فعلی را ببینید و تغییرات قابل ممیزی ثبت کنید.</p>
      </header>
      <ProductVariantPicker onChange={selectVariant} value={variantId} />
      {formError ? <Problem message={formError} /> : null}
      {mutationError ? <Problem message={problemMessage(mutationError)} /> : null}
      {variantId && current.isPending ? <Card><CardContent className="space-y-3 py-5"><Skeleton className="h-5 w-32" /><Skeleton className="h-20" /></CardContent></Card> : null}
      {variantId && displayed ? <InventoryStatus inventory={displayed} isRefreshing={current.isFetching} onRefresh={refresh} /> : null}
      {variantId ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader><CardTitle>پیکربندی موجودی</CardTitle><CardDescription>برای فعال‌کردن یا تغییر روش ردیابی این گونه.</CardDescription></CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={(event) => { void configureSubmit(event); }}>
                <FormField>
                  <FieldLabel>روش کنترل</FieldLabel>
                  <Select onValueChange={(value) => setTrackingMode(value as 'tracked' | 'untracked')} value={trackingMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="tracked">ردیابی‌شده</SelectItem><SelectItem value="untracked">بدون ردیابی</SelectItem></SelectContent>
                  </Select>
                </FormField>
                {trackingMode === 'tracked' ? <FormField><FieldLabel htmlFor="initial-on-hand">موجودی اولیه</FieldLabel><Input dir="ltr" id="initial-on-hand" inputMode="numeric" onChange={(event) => setInitialOnHand(event.target.value)} value={initialOnHand} /></FormField> : null}
                <label className="flex cursor-pointer items-start gap-2 text-sm leading-6" htmlFor="confirm-inventory-configuration"><Checkbox checked={configurationConfirmed} id="confirm-inventory-configuration" onCheckedChange={(value) => setConfigurationConfirmed(value === true)} /><span>روش کنترل و مقدار اولیه را بررسی کرده‌ام و ثبت آن را تأیید می‌کنم.</span></label>
                <Button disabled={!canAdjust || !configurationConfirmed || submitting} type="submit">{configure.isPending ? 'در حال ثبت…' : 'ثبت پیکربندی'}</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>اصلاح موجودی</CardTitle><CardDescription>عدد مثبت موجودی را افزایش و عدد منفی آن را کاهش می‌دهد.</CardDescription></CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={(event) => { void adjustmentSubmit(event); }}>
                <FormField><FieldLabel htmlFor="inventory-delta">تغییر تعداد</FieldLabel><Input dir="ltr" id="inventory-delta" inputMode="numeric" onChange={(event) => setDelta(event.target.value)} placeholder="-3 یا 10" value={delta} /></FormField>
                <FormField><FieldLabel htmlFor="inventory-reason">دلیل تغییر</FieldLabel><Input id="inventory-reason" onChange={(event) => setReasonCode(event.target.value)} placeholder="مثال: شمارش انبار" value={reasonCode} /></FormField>
                <FormField><FieldLabel htmlFor="inventory-note">یادداشت اختیاری</FieldLabel><Textarea id="inventory-note" maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} /></FormField>
                <label className="flex cursor-pointer items-start gap-2 text-sm leading-6" htmlFor="confirm-inventory-adjustment"><Checkbox checked={confirmed} id="confirm-inventory-adjustment" onCheckedChange={(value) => setConfirmed(value === true)} /><span>مقدار و دلیل تغییر را بررسی کرده‌ام و ثبت آن را تأیید می‌کنم.</span></label>
                <Button disabled={!canAdjust || !confirmed || submitting} type="submit">{adjust.isPending ? 'در حال ثبت…' : 'ثبت اصلاح موجودی'}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function InventoryStatus({ inventory, isRefreshing, onRefresh }: { readonly inventory: Inventory | { readonly variantId: string; readonly state: 'not_configured' | 'untracked' | 'tracked'; readonly trackingMode: 'tracked' | 'untracked' | null; readonly onHand: number | null; readonly reservedQuantity: number | null; readonly available: number | null }; readonly isRefreshing: boolean; readonly onRefresh: () => Promise<void> }) {
  const state = 'state' in inventory ? inventory.state : inventory.trackingMode;
  const tracked = state === 'tracked';
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>وضعیت فعلی</CardTitle><CardDescription><bdi dir="ltr">{inventory.variantId}</bdi></CardDescription></div><div className="flex items-center gap-2"><StatusBadge tone={tracked ? 'success' : 'neutral'}>{state === 'tracked' ? 'ردیابی‌شده' : state === 'untracked' ? 'بدون ردیابی' : 'تنظیم نشده'}</StatusBadge><Button aria-label="تازه‌سازی موجودی" disabled={isRefreshing} onClick={() => { void onRefresh(); }} size="icon" variant="ghost"><RefreshCw aria-hidden="true" /></Button></div></CardHeader>
      {tracked ? <CardContent><dl className="grid gap-4 sm:grid-cols-3"><Metric label="موجودی کل" value={inventory.onHand} /><Metric label="رزروشده" value={inventory.reservedQuantity} /><Metric label="قابل فروش" value={inventory.available} /></dl></CardContent> : <CardContent><p className="text-sm text-muted-foreground">برای موجودی بدون ردیابی، مقدار ساختگی یا بی‌نهایت نمایش داده نمی‌شود.</p></CardContent>}
    </Card>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: number | null }) {
  return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold"><bdi dir="ltr">{value === null ? '—' : value.toLocaleString('fa-IR')}</bdi></dd></div>;
}

function Problem({ message }: { readonly message: string }) {
  return <div className="flex gap-2 rounded-lg bg-card px-4 py-3 text-sm ring-1 ring-destructive/25" role="alert"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" /><p>{message}</p></div>;
}

function problemMessage(error: unknown) {
  if (isAdminApiError(error) && error.problem.kind === 'api') {
    if (error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.';
    if (error.problem.status === 409) return 'وضعیت موجودی تغییر کرده است. اطلاعات را تازه‌سازی و دوباره بررسی کنید.';
  }
  return 'عملیات موجودی ثبت نشد. دوباره تلاش کنید.';
}
