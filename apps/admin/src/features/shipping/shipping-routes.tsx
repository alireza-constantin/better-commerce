import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw, Trash2, Truck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { isAdminApiError } from '@/api/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import {
  createShippingMethodMutationOptions,
  createShippingRuleMutationOptions,
  createShippingZoneMutationOptions,
  deleteShippingMethodMutationOptions,
  deleteShippingRuleMutationOptions,
  deleteShippingZoneMutationOptions,
  shippingConfigurationQueryOptions,
  shippingQueryKeys,
  updateShippingMethodMutationOptions,
  updateShippingRuleMutationOptions,
  updateShippingZoneMutationOptions,
  type CreateMethodInput,
  type CreateZoneInput,
  type RateRuleInput,
  type ShippingMethod,
  type ShippingRule,
  type ShippingZone,
} from './api';

export function ShippingRoute() {
  return (
    <PermissionBoundary required={adminRoutes.shipping.permissions}>
      <ShippingRouteContent />
    </PermissionBoundary>
  );
}

function ShippingRouteContent() {
  const profile = useAdminSession();
  const queryClient = useQueryClient();
  const configuration = useQuery(shippingConfigurationQueryOptions());
  const createZone = useMutation(createShippingZoneMutationOptions());
  const updateZone = useMutation(updateShippingZoneMutationOptions());
  const deleteZone = useMutation(deleteShippingZoneMutationOptions());
  const createMethod = useMutation(createShippingMethodMutationOptions());
  const updateMethod = useMutation(updateShippingMethodMutationOptions());
  const deleteMethod = useMutation(deleteShippingMethodMutationOptions());
  const createRule = useMutation(createShippingRuleMutationOptions());
  const updateRule = useMutation(updateShippingRuleMutationOptions());
  const deleteRule = useMutation(deleteShippingRuleMutationOptions());
  const canWrite = hasPermission(profile.permissions, 'shipping.write');
  const mutationError =
    createZone.error ?? updateZone.error ?? deleteZone.error ?? createMethod.error ??
    updateMethod.error ?? deleteMethod.error ?? createRule.error ?? updateRule.error ??
    deleteRule.error;
  const isMutating =
    createZone.isPending || updateZone.isPending || deleteZone.isPending ||
    createMethod.isPending || updateMethod.isPending || deleteMethod.isPending ||
    createRule.isPending || updateRule.isPending || deleteRule.isPending;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: shippingQueryKeys.configuration() });
  useEffect(() => {
    if (
      isAdminApiError(mutationError) &&
      mutationError.problem.kind === 'api' &&
      mutationError.problem.status === 409
    ) {
      void queryClient.invalidateQueries({
        queryKey: shippingQueryKeys.configuration(),
      });
    }
  }, [mutationError, queryClient]);

  if (configuration.isPending) return <ShippingLoading />;
  if (configuration.isError) {
    return <ShippingError error={messageForError(configuration.error)} onRetry={() => void configuration.refetch()} />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em]">تنظیمات ارسال</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            محدوده‌ها، روش‌های ارسال و نرخ‌ها را بر اساس جمع سبد خرید تنظیم کنید.
          </p>
        </div>
        {canWrite ? <ZoneForm disabled={isMutating} onSubmit={async (data) => { await createZone.mutateAsync(data); await refresh(); }} /> : null}
      </header>

      {mutationError ? <MutationError error={mutationError} /> : null}

      {configuration.data.zones.length === 0 ? (
        <ShippingEmpty canWrite={canWrite} />
      ) : (
        <div className="space-y-5">
          {configuration.data.zones.map((zone) => (
            <ZoneSection
              canWrite={canWrite}
              disabled={isMutating}
              key={zone.id}
              methods={configuration.data.methods.filter((method) => method.zoneId === zone.id)}
              onCreateMethod={async (data) => { await createMethod.mutateAsync({ zoneId: zone.id, data }); await refresh(); }}
              onDelete={async () => { await deleteZone.mutateAsync(zone.id); await refresh(); }}
              onUpdate={async (data) => { await updateZone.mutateAsync({ id: zone.id, data }); await refresh(); }}
              rules={configuration.data.rules}
              zone={zone}
              onCreateRule={async (methodId, data) => { await createRule.mutateAsync({ methodId, data }); await refresh(); }}
              onDeleteMethod={async (id) => { await deleteMethod.mutateAsync(id); await refresh(); }}
              onDeleteRule={async (id) => { await deleteRule.mutateAsync(id); await refresh(); }}
              onUpdateMethod={async (id, data) => { await updateMethod.mutateAsync({ id, data }); await refresh(); }}
              onUpdateRule={async (id, data) => { await updateRule.mutateAsync({ id, data }); await refresh(); }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ZoneSection(props: {
  readonly zone: ShippingZone;
  readonly methods: readonly ShippingMethod[];
  readonly rules: readonly ShippingRule[];
  readonly canWrite: boolean;
  readonly disabled: boolean;
  readonly onUpdate: (data: { name?: string; country?: string; province?: string | null; city?: string | null; postalPrefix?: string | null; active?: boolean }) => Promise<void>;
  readonly onDelete: () => Promise<void>;
  readonly onCreateMethod: (data: CreateMethodInput) => Promise<void>;
  readonly onUpdateMethod: (id: string, data: { title?: string; position?: number; active?: boolean }) => Promise<void>;
  readonly onDeleteMethod: (id: string) => Promise<void>;
  readonly onCreateRule: (methodId: string, data: RateRuleInput) => Promise<void>;
  readonly onUpdateRule: (id: string, data: RateRuleInput) => Promise<void>;
  readonly onDeleteRule: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const location = [props.zone.city, props.zone.province, props.zone.country, props.zone.postalPrefix].filter(Boolean).join('، ');
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{props.zone.name}</h2><Status active={props.zone.active} /></div>
          <p className="mt-1 text-sm text-muted-foreground"><bdi dir="ltr">{location}</bdi></p>
        </div>
        {props.canWrite ? <div className="flex gap-2"><Button onClick={() => setEditing((value) => !value)} size="sm" variant="outline"><Pencil aria-hidden="true" /> ویرایش محدوده</Button><DestructiveAction disabled={props.disabled} label="حذف محدوده" onConfirm={props.onDelete} /></div> : null}
      </div>
      {editing ? <ZoneEditForm disabled={props.disabled} onCancel={() => setEditing(false)} onSubmit={async (data) => { await props.onUpdate(data); setEditing(false); }} zone={props.zone} /> : null}
      <div className="space-y-4 p-5">
        {props.methods.map((method) => <MethodSection canWrite={props.canWrite} disabled={props.disabled} key={method.id} method={method} onCreateRule={props.onCreateRule} onDelete={props.onDeleteMethod} onDeleteRule={props.onDeleteRule} onUpdate={props.onUpdateMethod} onUpdateRule={props.onUpdateRule} rules={props.rules.filter((rule) => rule.methodId === method.id)} />)}
        {props.methods.length === 0 ? <p className="py-2 text-sm text-muted-foreground">هنوز روشی برای این محدوده ثبت نشده است.</p> : null}
        {props.canWrite ? <MethodForm disabled={props.disabled} onSubmit={props.onCreateMethod} /> : null}
      </div>
    </section>
  );
}

function MethodSection(props: {
  readonly method: ShippingMethod;
  readonly rules: readonly ShippingRule[];
  readonly canWrite: boolean;
  readonly disabled: boolean;
  readonly onUpdate: (id: string, data: { title?: string; position?: number; active?: boolean }) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onCreateRule: (methodId: string, data: RateRuleInput) => Promise<void>;
  readonly onUpdateRule: (id: string, data: RateRuleInput) => Promise<void>;
  readonly onDeleteRule: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  return <div className="rounded-md bg-muted/35 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{props.method.title}</h3><Status active={props.method.active} /><span className="text-xs text-muted-foreground">اولویت: <bdi dir="ltr">{props.method.position}</bdi></span></div>{props.canWrite ? <div className="flex gap-2"><Button onClick={() => setEditing((value) => !value)} size="sm" variant="ghost"><Pencil aria-hidden="true" /> ویرایش</Button><DestructiveAction disabled={props.disabled} label="حذف روش" onConfirm={() => props.onDelete(props.method.id)} /></div> : null}</div>{editing ? <MethodEditForm disabled={props.disabled} method={props.method} onCancel={() => setEditing(false)} onSubmit={async (data) => { await props.onUpdate(props.method.id, data); setEditing(false); }} /> : null}<div className="mt-4 space-y-2">{props.rules.length ? props.rules.map((rule) => <RuleRow canWrite={props.canWrite} disabled={props.disabled} key={rule.id} onDelete={props.onDeleteRule} onUpdate={props.onUpdateRule} rule={rule} />) : <p className="text-sm text-muted-foreground">برای این روش نرخ فعالی تعریف نشده است.</p>}{props.canWrite ? <RuleForm disabled={props.disabled} onSubmit={(data) => props.onCreateRule(props.method.id, data)} /> : null}</div></div>;
}

function RuleRow({ canWrite, disabled, onDelete, onUpdate, rule }: { readonly rule: ShippingRule; readonly canWrite: boolean; readonly disabled: boolean; readonly onUpdate: (id: string, data: RateRuleInput) => Promise<void>; readonly onDelete: (id: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  return <div className="rounded-md border border-border bg-background px-3 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><p>از <Money value={rule.minimumSubtotal} currency={rule.currency} /> تا {rule.maximumSubtotal === null ? 'بدون سقف' : <Money value={rule.maximumSubtotal} currency={rule.currency} />} — هزینه: <Money value={rule.amount} currency={rule.currency} /></p><div className="flex items-center gap-2"><Status active={rule.active} />{canWrite ? <><Button onClick={() => setEditing((value) => !value)} size="sm" variant="ghost"><Pencil aria-hidden="true" /><span className="sr-only">ویرایش نرخ</span></Button><DestructiveAction disabled={disabled} label="حذف نرخ" onConfirm={() => onDelete(rule.id)} /></> : null}</div></div>{editing ? <RuleEditForm disabled={disabled} onCancel={() => setEditing(false)} onSubmit={async (data) => { await onUpdate(rule.id, data); setEditing(false); }} rule={rule} /> : null}</div>;
}

function ZoneForm({ disabled, onSubmit }: { readonly disabled: boolean; readonly onSubmit: (data: CreateZoneInput) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <>{open ? <ZoneFields disabled={disabled} onCancel={() => setOpen(false)} onSubmit={async (data) => { await onSubmit(data as CreateZoneInput); setOpen(false); }} submitLabel="ثبت محدوده" /> : <Button onClick={() => setOpen(true)}><Plus aria-hidden="true" /> افزودن محدوده</Button>}</>;
}

function ZoneEditForm({ disabled, onCancel, onSubmit, zone }: { readonly zone: ShippingZone; readonly disabled: boolean; readonly onCancel: () => void; readonly onSubmit: (data: { name?: string; country?: string; province?: string | null; city?: string | null; postalPrefix?: string | null; active?: boolean }) => Promise<void> }) { return <div className="border-b border-border bg-muted/25 px-5 py-4"><ZoneFields disabled={disabled} initial={zone} onCancel={onCancel} onSubmit={onSubmit} submitLabel="ذخیره تغییرات" /></div>; }

function ZoneFields({ disabled, initial, onCancel, onSubmit, submitLabel }: { readonly disabled: boolean; readonly initial?: ShippingZone; readonly onCancel: () => void; readonly onSubmit: (data: CreateZoneInput | { name?: string; country?: string; province?: string | null; city?: string | null; postalPrefix?: string | null; active?: boolean }) => Promise<void>; readonly submitLabel: string }) {
  const [name, setName] = useState(initial?.name ?? ''); const [country, setCountry] = useState(initial?.country ?? 'IR'); const [province, setProvince] = useState(initial?.province ?? ''); const [city, setCity] = useState(initial?.city ?? ''); const [postalPrefix, setPostalPrefix] = useState(initial?.postalPrefix ?? ''); const [active, setActive] = useState(initial?.active ?? true);
  return <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (!name.trim() || country.trim().length !== 2) return; const data = { name: name.trim(), country: country.trim().toUpperCase(), province: province.trim() || null, city: city.trim() || null, postalPrefix: postalPrefix.trim() || null, active }; void onSubmit(initial ? data : { ...data, province: province.trim() || undefined, city: city.trim() || undefined, postalPrefix: postalPrefix.trim() || undefined }).catch(() => undefined); }}><Field label="نام محدوده"><input autoFocus className={inputClass} onChange={(event) => setName(event.target.value)} value={name} /></Field><Field label="کد کشور"><input className={inputClass} dir="ltr" maxLength={2} onChange={(event) => setCountry(event.target.value)} value={country} /></Field><Field label="استان"><input className={inputClass} onChange={(event) => setProvince(event.target.value)} value={province} /></Field><Field label="شهر"><input className={inputClass} onChange={(event) => setCity(event.target.value)} value={city} /></Field><Field label="پیش‌شماره پستی"><input className={inputClass} dir="ltr" onChange={(event) => setPostalPrefix(event.target.value)} value={postalPrefix} /></Field><ActiveField active={active} onChange={setActive} /><FormActions disabled={disabled} onCancel={onCancel} submitLabel={submitLabel} /></form>;
}

function MethodForm({ disabled, onSubmit }: { readonly disabled: boolean; readonly onSubmit: (data: CreateMethodInput) => Promise<void> }) { const [open, setOpen] = useState(false); return open ? <MethodFields disabled={disabled} onCancel={() => setOpen(false)} onSubmit={async (data) => { await onSubmit(data as CreateMethodInput); setOpen(false); }} submitLabel="ثبت روش ارسال" /> : <Button onClick={() => setOpen(true)} size="sm" variant="outline"><Plus aria-hidden="true" /> افزودن روش ارسال</Button>; }
function MethodEditForm({ disabled, method, onCancel, onSubmit }: { readonly disabled: boolean; readonly method: ShippingMethod; readonly onCancel: () => void; readonly onSubmit: (data: { title?: string; position?: number; active?: boolean }) => Promise<void> }) { return <MethodFields disabled={disabled} initial={method} onCancel={onCancel} onSubmit={onSubmit} submitLabel="ذخیره روش" />; }
function MethodFields({ disabled, initial, onCancel, onSubmit, submitLabel }: { readonly disabled: boolean; readonly initial?: ShippingMethod; readonly onCancel: () => void; readonly onSubmit: (data: CreateMethodInput | { title?: string; position?: number; active?: boolean }) => Promise<void>; readonly submitLabel: string }) { const [title, setTitle] = useState(initial?.title ?? ''); const [position, setPosition] = useState(String(initial?.position ?? 0)); const [active, setActive] = useState(initial?.active ?? true); return <form className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); if (!title.trim() || !/^-?\d+$/.test(position)) return; void onSubmit({ title: title.trim(), position: Number(position), active }).catch(() => undefined); }}><Field label="عنوان روش"><input autoFocus className={inputClass} onChange={(event) => setTitle(event.target.value)} value={title} /></Field><Field label="اولویت"><input className={inputClass} dir="ltr" inputMode="numeric" onChange={(event) => setPosition(event.target.value)} value={position} /></Field><ActiveField active={active} onChange={setActive} /><FormActions disabled={disabled} onCancel={onCancel} submitLabel={submitLabel} /></form>; }

function RuleForm({ disabled, onSubmit }: { readonly disabled: boolean; readonly onSubmit: (data: RateRuleInput) => Promise<void> }) { const [open, setOpen] = useState(false); return open ? <RuleFields disabled={disabled} onCancel={() => setOpen(false)} onSubmit={async (data) => { await onSubmit(data); setOpen(false); }} submitLabel="ثبت نرخ" /> : <Button className="mt-2" onClick={() => setOpen(true)} size="sm" variant="ghost"><Plus aria-hidden="true" /> افزودن نرخ</Button>; }
function RuleEditForm({ disabled, onCancel, onSubmit, rule }: { readonly disabled: boolean; readonly onCancel: () => void; readonly onSubmit: (data: RateRuleInput) => Promise<void>; readonly rule: ShippingRule }) { return <RuleFields disabled={disabled} initial={rule} onCancel={onCancel} onSubmit={onSubmit} submitLabel="ذخیره نرخ" />; }
function RuleFields({ disabled, initial, onCancel, onSubmit, submitLabel }: { readonly disabled: boolean; readonly initial?: ShippingRule; readonly onCancel: () => void; readonly onSubmit: (data: RateRuleInput) => Promise<void>; readonly submitLabel: string }) { const [minimumSubtotal, setMinimum] = useState(initial?.minimumSubtotal ?? '0.00'); const [maximumSubtotal, setMaximum] = useState(initial?.maximumSubtotal ?? ''); const [amount, setAmount] = useState(initial?.amount ?? ''); const [currency, setCurrency] = useState(initial?.currency ?? 'IRR'); const [active, setActive] = useState(initial?.active ?? true); return <form className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => { event.preventDefault(); if (!isExactAmount(minimumSubtotal) || !isExactAmount(amount) || (maximumSubtotal && !isExactAmount(maximumSubtotal)) || currency.trim().length !== 3) return; void onSubmit({ minimumSubtotal: minimumSubtotal.trim(), maximumSubtotal: maximumSubtotal.trim() || null, amount: amount.trim(), currency: currency.trim().toUpperCase(), active }).catch(() => undefined); }}><Field label="حداقل جمع سبد"><input className={inputClass} dir="ltr" onChange={(event) => setMinimum(event.target.value)} placeholder="0.00" value={minimumSubtotal} /></Field><Field label="حداکثر جمع سبد"><input className={inputClass} dir="ltr" onChange={(event) => setMaximum(event.target.value)} placeholder="بدون سقف" value={maximumSubtotal} /></Field><Field label="هزینه ارسال"><input className={inputClass} dir="ltr" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} /></Field><Field label="ارز"><input className={inputClass} dir="ltr" maxLength={3} onChange={(event) => setCurrency(event.target.value)} value={currency} /></Field><ActiveField active={active} onChange={setActive} /><FormActions disabled={disabled} onCancel={onCancel} submitLabel={submitLabel} /></form>; }

function DestructiveAction({ disabled, label, onConfirm }: { readonly disabled: boolean; readonly label: string; readonly onConfirm: () => Promise<void> }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button aria-label={label} disabled={disabled} size="icon" variant="ghost"><Trash2 aria-hidden="true" className="text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>{label} انجام شود؟</AlertDialogTitle><AlertDialogDescription>این عملیات روی تنظیمات فعال ارسال اثر می‌گذارد و باید پیش از ادامه بررسی شود.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={() => { void onConfirm(); }}>{label}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function Field({ children, label }: { readonly label: string; readonly children: ReactNode }) { return <label className="block text-sm font-medium">{label}<span className="mt-1.5 block">{children}</span></label>; }
function ActiveField({ active, onChange }: { readonly active: boolean; readonly onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={active} onCheckedChange={(value) => onChange(value === true)} /> فعال</label>; }
function FormActions({ disabled, onCancel, submitLabel }: { readonly disabled: boolean; readonly onCancel: () => void; readonly submitLabel: string }) { return <div className="flex items-end gap-2 sm:col-span-2"><Button disabled={disabled} type="submit">{disabled ? 'در حال ثبت…' : submitLabel}</Button><Button disabled={disabled} onClick={onCancel} type="button" variant="ghost">انصراف</Button></div>; }
function Status({ active }: { readonly active: boolean }) { return <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'فعال' : 'غیرفعال'}</StatusBadge>; }
function Money({ currency, value }: { readonly value: string; readonly currency: string }) { return <bdi dir="ltr">{value} {currency}</bdi>; }
function ShippingLoading() { return <main aria-busy="true" aria-label="در حال دریافت تنظیمات ارسال" className="mx-auto max-w-6xl space-y-5" dir="rtl"><Skeleton className="h-9 w-44" />{Array.from({ length: 2 }, (_, index) => <Skeleton className="h-48 rounded-lg" key={index} />)}</main>; }
function ShippingEmpty({ canWrite }: { readonly canWrite: boolean }) { return <Empty className="min-h-72 border border-dashed bg-card"><EmptyHeader><EmptyMedia variant="icon"><Truck aria-hidden="true" /></EmptyMedia><EmptyTitle>محدوده ارسالی تعریف نشده است</EmptyTitle><EmptyDescription>برای شروع، محدوده‌ای بسازید و سپس روش و نرخ ارسال آن را اضافه کنید.</EmptyDescription>{!canWrite ? <p className="text-sm text-muted-foreground">حساب شما فقط اجازه مشاهده تنظیمات ارسال را دارد.</p> : null}</EmptyHeader></Empty>; }
function ShippingError({ error, onRetry }: { readonly error: string; readonly onRetry: () => void }) { return <main className="mx-auto max-w-2xl rounded-lg border border-destructive/25 bg-card px-5 py-6" dir="rtl" role="alert"><h1 className="font-semibold">تنظیمات ارسال دریافت نشد</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p><Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button></main>; }
function MutationError({ error }: { readonly error: unknown }) { const requestId = isAdminApiError(error) && 'requestId' in error.problem ? error.problem.requestId : undefined; return <div className="rounded-lg border border-destructive/25 bg-card px-4 py-3 text-sm" role="alert"><p>{messageForError(error)}</p>{requestId ? <p className="mt-1 text-xs text-muted-foreground">شناسه درخواست: <bdi dir="ltr">{requestId}</bdi></p> : null}</div>; }
function messageForError(error: unknown) { if (isAdminApiError(error) && error.problem.kind === 'api') { if (error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.'; if (error.problem.status === 409) return 'این تغییر با تنظیمات فعلی سازگار نیست. محدوده نرخ‌ها را بررسی کنید.'; if (error.problem.status === 422 || error.problem.status === 400) return 'اطلاعات واردشده معتبر نیست. مقادیر و بازه مبلغ را بررسی کنید.'; } return 'پاسخ معتبری از سرویس ارسال دریافت نشد. دوباره تلاش کنید.'; }
function isExactAmount(value: string) { return /^\d+(?:\.\d+)?$/.test(value.trim()); }
const inputClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring';
