import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AlertTriangle, Boxes } from 'lucide-react';
import { isAdminApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { adjustInventoryMutationOptions, configureInventoryMutationOptions, type Inventory } from './api';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTEGER_PATTERN = /^-?\d+$/;

export function InventoryRoute() {
  return <PermissionBoundary required={adminRoutes.inventory.permissions}><InventoryContent /></PermissionBoundary>;
}

function InventoryContent() {
  const profile = useAdminSession();
  const configure = useMutation(configureInventoryMutationOptions());
  const adjust = useMutation(adjustInventoryMutationOptions());
  const [variantId, setVariantId] = useState('');
  const [trackingMode, setTrackingMode] = useState<'tracked' | 'untracked'>('tracked');
  const [initialOnHand, setInitialOnHand] = useState('0');
  const [configurationConfirmed, setConfigurationConfirmed] = useState(false);
  const [delta, setDelta] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [inventory, setInventory] = useState<Inventory>();
  const [formError, setFormError] = useState<string>();
  const canAdjust = hasPermission(profile.permissions, 'inventory.adjust');
  const submitting = configure.isPending || adjust.isPending;

  const validId = () => {
    const id = variantId.trim();
    if (!UUID_PATTERN.test(id)) { setFormError('شناسه گونه باید یک UUID معتبر باشد.'); return undefined; }
    return id;
  };
  const configureSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const id = validId();
    if (!id || !canAdjust) return;
    if (!/^\d+$/.test(initialOnHand) || !Number.isSafeInteger(Number(initialOnHand))) { setFormError('موجودی اولیه باید یک عدد صحیح صفر یا بیشتر باشد.'); return; }
    if (!configurationConfirmed) { setFormError('برای ثبت پیکربندی موجودی، تأیید را انتخاب کنید.'); return; }
    setFormError(undefined);
    try { setInventory(await configure.mutateAsync({ variantId: id, data: { trackingMode, initialOnHand: Number(initialOnHand) } })); setConfigurationConfirmed(false); } catch { /* The normalized problem is displayed below. */ }
  };
  const adjustmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const id = validId();
    if (!id || !canAdjust) return;
    if (!INTEGER_PATTERN.test(delta) || Number(delta) === 0 || !Number.isSafeInteger(Number(delta))) { setFormError('تغییر موجودی باید یک عدد صحیح غیرصفر باشد.'); return; }
    if (!reasonCode.trim() || reasonCode.trim().length > 80) { setFormError('کد دلیل را وارد کنید (حداکثر ۸۰ نویسه).'); return; }
    if (note.length > 500) { setFormError('یادداشت نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.'); return; }
    if (!confirmed) { setFormError('برای ثبت تغییر موجودی، تأیید را انتخاب کنید.'); return; }
    setFormError(undefined);
    try { setInventory(await adjust.mutateAsync({ variantId: id, data: { delta: Number(delta), reasonCode: reasonCode.trim(), note: note.trim() || undefined } })); setDelta(''); setReasonCode(''); setNote(''); setConfirmed(false); } catch { /* The normalized problem is displayed below. */ }
  };
  const mutationError = configure.error ?? adjust.error;

  return <section className="mx-auto max-w-3xl space-y-6" dir="rtl">
    <header><div className="flex items-center gap-2"><Boxes className="size-5 text-muted-foreground" aria-hidden="true" /><h1 className="text-2xl font-semibold tracking-[-0.025em]">موجودی</h1></div><p className="mt-2 text-sm leading-6 text-muted-foreground">موجودی هر گونه را با شناسه آن پیکربندی یا اصلاح کنید. پاسخ ثبت‌شده از سرویس، وضعیت معتبر فعلی است.</p></header>
    {formError ? <Problem message={formError} /> : null}{mutationError ? <Problem message={problemMessage(mutationError)} /> : null}
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="inventory-configure-heading"><h2 className="font-semibold" id="inventory-configure-heading">پیکربندی موجودی</h2><p className="mt-1 text-sm text-muted-foreground">برای گونه‌ای که قبلاً پیکربندی نشده است استفاده کنید.</p>
      <form className="mt-5 space-y-4" onSubmit={(event) => { void configureSubmit(event); }}><VariantIdInput value={variantId} onChange={setVariantId} /><fieldset><legend className="text-sm font-medium">روش کنترل</legend><div className="mt-2 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input checked={trackingMode === 'tracked'} name="tracking-mode" onChange={() => setTrackingMode('tracked')} type="radio" />کنترل‌شده</label><label className="flex items-center gap-2"><input checked={trackingMode === 'untracked'} name="tracking-mode" onChange={() => setTrackingMode('untracked')} type="radio" />بدون کنترل</label></div></fieldset><label className="block text-sm font-medium">موجودی اولیه<input className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" inputMode="numeric" onChange={(event) => setInitialOnHand(event.target.value)} value={initialOnHand} /></label><label className="flex cursor-pointer items-start gap-2 text-sm leading-6"><input checked={configurationConfirmed} className="mt-1 size-4 accent-primary" onChange={(event) => setConfigurationConfirmed(event.target.checked)} type="checkbox" /><span>روش کنترل و موجودی اولیه را بررسی کرده‌ام و ثبت آن را تأیید می‌کنم.</span></label><Button disabled={!canAdjust || !configurationConfirmed || submitting} type="submit">{configure.isPending ? 'در حال ثبت…' : 'پیکربندی موجودی'}</Button>{!canAdjust ? <p className="text-sm text-muted-foreground">برای پیکربندی موجودی، مجوز لازم را ندارید.</p> : null}</form>
    </section>
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="inventory-adjust-heading"><h2 className="font-semibold" id="inventory-adjust-heading">اصلاح موجودی</h2><p className="mt-1 text-sm text-muted-foreground">عدد مثبت موجودی را افزایش و عدد منفی آن را کاهش می‌دهد.</p>
      <form className="mt-5 space-y-4" onSubmit={(event) => { void adjustmentSubmit(event); }}><VariantIdInput value={variantId} onChange={setVariantId} /><label className="block text-sm font-medium">تغییر تعداد<input className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" inputMode="numeric" onChange={(event) => setDelta(event.target.value)} placeholder="-3 یا 10" value={delta} /></label><label className="block text-sm font-medium">کد دلیل<input className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => setReasonCode(event.target.value)} placeholder="مثال: شمارش انبار" value={reasonCode} /></label><label className="block text-sm font-medium">یادداشت (اختیاری)<textarea className="mt-2 min-h-22 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} /></label><label className="flex cursor-pointer items-start gap-2 text-sm leading-6"><input checked={confirmed} className="mt-1 size-4 accent-primary" onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span>تغییر مقدار و دلیل را بررسی کرده‌ام و ثبت آن را تأیید می‌کنم.</span></label><Button disabled={!canAdjust || !confirmed || submitting} type="submit">{adjust.isPending ? 'در حال ثبت…' : 'ثبت اصلاح موجودی'}</Button></form>
    </section>
    {inventory ? <InventoryResult inventory={inventory} /> : <p className="rounded-lg border border-dashed border-border px-5 py-4 text-sm leading-6 text-muted-foreground">پس از پیکربندی یا اصلاح، وضعیت معتبر موجودی اینجا نمایش داده می‌شود. API فعلی فهرست یا واکشی تکی موجودی ندارد.</p>}
  </section>;
}

function VariantIdInput({ onChange, value }: { readonly value: string; readonly onChange: (value: string) => void }) { return <label className="block text-sm font-medium">شناسه گونه کالا<input className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" onChange={(event) => onChange(event.target.value)} placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx" value={value} /></label>; }
function InventoryResult({ inventory }: { readonly inventory: Inventory }) { return <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="inventory-current-heading"><h2 className="font-semibold" id="inventory-current-heading">وضعیت ثبت‌شده</h2><p className="mt-1 text-sm text-muted-foreground">شناسه گونه: <bdi dir="ltr">{inventory.variantId}</bdi></p><dl className="mt-5 grid gap-4 sm:grid-cols-3"><Metric label="موجودی کل" value={inventory.onHand} /><Metric label="رزروشده" value={inventory.reservedQuantity} /><Metric label="قابل فروش" value={inventory.available} /></dl><p className="mt-4 text-xs text-muted-foreground">روش کنترل: {inventory.trackingMode === 'tracked' ? 'کنترل‌شده' : 'بدون کنترل'} · نسخه: <bdi dir="ltr">{inventory.version}</bdi></p></section>; }
function Metric({ label, value }: { readonly label: string; readonly value: number }) { return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold"><bdi dir="ltr">{value.toLocaleString('fa-IR')}</bdi></dd></div>; }
function Problem({ message }: { readonly message: string }) { return <div className="flex gap-2 rounded-lg border border-destructive/25 bg-card px-4 py-3 text-sm" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><p>{message}</p></div>; }
function problemMessage(error: unknown) { if (isAdminApiError(error) && error.problem.kind === 'api') { if (error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.'; if (error.problem.status === 409) return 'وضعیت موجودی تغییر کرده است. اطلاعات را بررسی و دوباره تلاش کنید.'; } return 'عملیات موجودی ثبت نشد. دوباره تلاش کنید.'; }
