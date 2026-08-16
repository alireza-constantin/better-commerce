import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
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
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FeedbackPanel,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { ProductVariantPicker } from '@/features/catalog/components/product-variant-picker';
import { categoriesQuery, collectionsQuery } from '@/features/catalog/api/catalog-navigation-query';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import {
  createPromotionMutationOptions,
  promotionQueryOptions,
  promotionRedemptionsQueryOptions,
  promotionsListQueryOptions,
  promotionsQueryKeys,
  replacePromotionMutationOptions,
  transitionPromotionMutationOptions,
} from './api/promotions-query';
import type { CreatePromotionInput, Promotion, ReplacePromotionInput } from './api/promotions-api';

const statusLabels: Record<Promotion['status'], string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  active: 'فعال',
  paused: 'متوقف',
  ended: 'پایان‌یافته',
};

const statusTones: Record<Promotion['status'], 'neutral' | 'info' | 'success' | 'warning' | 'destructive'> = {
  draft: 'neutral', scheduled: 'info', active: 'success', paused: 'warning', ended: 'destructive',
};

export function PromotionsRoute() {
  return <PermissionBoundary required={adminRoutes.promotions.permissions}><PromotionsContent /></PermissionBoundary>;
}

function PromotionsContent() {
  const session = useAdminSession();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPromotionId, setSelectedPromotionId] = useState('');
  const [confirmation, setConfirmation] = useState<{ item: Promotion; action: 'activate' | 'pause' | 'end' }>();
  const [query, setQuery] = useState('');
  const promotions = useQuery(promotionsListQueryOptions(query ? { q: query } : {}));
  const canWrite = hasPermission(session.permissions, 'promotions.write');
  const create = useMutation({
    ...createPromotionMutationOptions(),
    onSuccess: async () => {
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: promotionsQueryKeys.all });
    },
  });
  const transition = useMutation({
    ...transitionPromotionMutationOptions(),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: promotionsQueryKeys.all }),
  });

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-5" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2"><Megaphone aria-hidden="true" className="size-5 text-primary" /><h1 className="text-2xl font-semibold tracking-tight">تخفیف‌ها و کمپین‌ها</h1></div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">کدهای تخفیف و پیشنهادهای فروش را مدیریت کنید؛ وضعیت و تاریخچه هر تغییر برای تیم شما قابل پیگیری است.</p>
        </div>
        {canWrite ? <Button onClick={() => setShowCreate((value) => !value)}><Plus aria-hidden="true" /> پیشنهاد جدید</Button> : null}
      </header>

      {showCreate && canWrite ? <CreatePromotionCard mutation={create} /> : null}
      {create.isError ? <FeedbackPanel tone="error" title="پیشنهاد ذخیره نشد">{problemMessage(create.error, 'اطلاعات پیشنهاد را بررسی کنید و دوباره تلاش کنید.')}</FeedbackPanel> : null}
      {transition.isError ? <FeedbackPanel tone="error" title="وضعیت پیشنهاد تغییر نکرد">{problemMessage(transition.error, 'وضعیت فعلی پیشنهاد تغییر نکرد. صفحه را تازه کنید.')}</FeedbackPanel> : null}

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><CardTitle>پیشنهادهای فروش</CardTitle><CardDescription>پیشنهاد عمومی یا کددار را از همین‌جا فعال و متوقف کنید.</CardDescription></div>
          <div className="flex items-center gap-2">
            <Input aria-label="جست‌وجوی پیشنهادها" className="w-48" onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجو…" value={query} />
            <Button aria-label="تازه‌سازی پیشنهادها" disabled={promotions.isFetching} onClick={() => { void promotions.refetch(); }} size="icon" variant="ghost"><RefreshCw aria-hidden="true" className="size-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {promotions.isPending ? <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : null}
          {promotions.isError ? <FeedbackPanel tone="error" title="پیشنهادها دریافت نشد">{problemMessage(promotions.error, 'دریافت پیشنهادها با مشکل روبه‌رو شد.')}</FeedbackPanel> : null}
          {promotions.data && promotions.data.items.length === 0 ? <FeedbackPanel tone="info" title="هنوز پیشنهادی ندارید">با ساختن اولین پیشنهاد، فروش‌های ویژه خود را شروع کنید.</FeedbackPanel> : null}
          {promotions.data && promotions.data.items.length > 0 ? <PromotionTable items={promotions.data.items} canWrite={canWrite} busy={transition.isPending} onSelect={setSelectedPromotionId} onTransition={(item, action) => setConfirmation({ item, action })} /> : null}
        </CardContent>
      </Card>
      {selectedPromotionId ? <PromotionDetailCard key={selectedPromotionId} promotionId={selectedPromotionId} canWrite={canWrite} /> : null}
      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) setConfirmation(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>تغییر وضعیت پیشنهاد؟</AlertDialogTitle><AlertDialogDescription>{confirmation ? `وضعیت «${confirmation.item.name}» تغییر می‌کند. این تغییر روی سفارش‌های ثبت‌شده اثری ندارد.` : ''}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction onClick={() => { if (!confirmation) return; void transition.mutateAsync({ promotionId: confirmation.item.id, action: confirmation.action, body: { expectedVersion: confirmation.item.version } }); setConfirmation(undefined); }}>{confirmation?.action === 'end' ? 'پایان پیشنهاد' : confirmation?.action === 'pause' ? 'توقف پیشنهاد' : 'فعال‌سازی پیشنهاد'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CreatePromotionCard({ mutation }: { readonly mutation: ReturnType<typeof useMutation<Promotion, Error, CreatePromotionInput>> }) {
  const [ruleKind, setRuleKind] = useState<CreatePromotionInput['rule']['kind']>('percentage');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => {
      const entry = form.get(name);
      return typeof entry === 'string' ? entry.trim() : '';
    };
    const input: CreatePromotionInput = {
      name: value('name'), description: value('description') || null,
      eligibility: value('eligibility') as CreatePromotionInput['eligibility'],
      code: value('code') || null,
      rule: ruleKind === 'percentage' ? { kind: 'percentage', percentage: value('amount') } : { kind: 'fixed_amount', amount: value('amount'), currency: value('currency') || 'USD' },
      target: { kind: 'cart', ids: [] }, priority: 0,
      startsAt: new Date().toISOString(), endsAt: null, totalLimit: null, perCustomerLimit: null,
    };
    void mutation.mutateAsync(input);
  };
  return <Card className="border-primary/25 bg-primary/[0.02]"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles aria-hidden="true" className="size-4 text-primary" />ساخت پیشنهاد جدید</CardTitle><CardDescription>در این مرحله پیشنهاد روی کل سبد خرید اعمال می‌شود؛ می‌توانید بعداً جزئیات آن را ویرایش کنید.</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
    <FormField><FieldLabel htmlFor="promotion-name">نام پیشنهاد</FieldLabel><Input id="promotion-name" name="name" required placeholder="مثلاً تخفیف تابستانی" /></FormField>
    <FormField><FieldLabel htmlFor="promotion-eligibility">نحوه استفاده</FieldLabel><Select defaultValue="public" name="eligibility"><SelectTrigger id="promotion-eligibility"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">برای همه مشتریان</SelectItem><SelectItem value="code_required">با کد تخفیف</SelectItem></SelectContent></Select></FormField>
    <FormField><FieldLabel htmlFor="promotion-code">کد تخفیف (اختیاری)</FieldLabel><Input dir="ltr" id="promotion-code" name="code" placeholder="SUMMER25" /></FormField>
    <FormField><FieldLabel htmlFor="promotion-rule">نوع تخفیف</FieldLabel><Select defaultValue="percentage" onValueChange={(value) => setRuleKind(value as CreatePromotionInput['rule']['kind'])}><SelectTrigger id="promotion-rule"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">درصدی</SelectItem><SelectItem value="fixed_amount">مبلغ ثابت</SelectItem></SelectContent></Select></FormField>
    <FormField><FieldLabel htmlFor="promotion-amount">مقدار تخفیف</FieldLabel><Input dir="ltr" id="promotion-amount" name="amount" inputMode="decimal" required placeholder={ruleKind === 'percentage' ? '15.00' : '20.00'} /></FormField>
    {ruleKind === 'fixed_amount' ? <FormField><FieldLabel htmlFor="promotion-currency">واحد پول</FieldLabel><Input dir="ltr" id="promotion-currency" maxLength={3} name="currency" placeholder="USD" /></FormField> : null}
    <FormField className="md:col-span-2"><FieldLabel htmlFor="promotion-description">توضیح داخلی (اختیاری)</FieldLabel><Input id="promotion-description" name="description" placeholder="این توضیح فقط برای تیم فروش دیده می‌شود." /></FormField>
    <div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? 'در حال ذخیره…' : 'ذخیره پیش‌نویس'}</Button></div>
  </form></CardContent></Card>;
}

function PromotionTable({ items, canWrite, busy, onSelect, onTransition }: { readonly items: readonly Promotion[]; readonly canWrite: boolean; readonly busy: boolean; readonly onSelect: (id: string) => void; readonly onTransition: (item: Promotion, action: 'activate' | 'pause' | 'end') => void }) {
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>پیشنهاد</TableHead><TableHead>وضعیت</TableHead><TableHead>قانون</TableHead><TableHead>استفاده</TableHead><TableHead className="text-left">عملیات</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell><button className="text-right font-medium text-primary underline-offset-4 hover:underline" onClick={() => onSelect(item.id)} type="button">{item.name}</button><div className="text-xs text-muted-foreground">{item.eligibility === 'code_required' ? <bdi dir="ltr">{item.code || 'کد ثبت نشده'}</bdi> : 'عمومی'}</div></TableCell><TableCell><StatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</StatusBadge></TableCell><TableCell>{item.rule.kind === 'percentage' ? `${item.rule.percentage ?? '۰'}٪` : item.rule.amount ? <bdi dir="ltr">{item.rule.amount.amount} {item.rule.amount.currency}</bdi> : 'مبلغ ثابت'}</TableCell><TableCell>{item.redemptions.total.toLocaleString('fa-IR')}{item.totalLimit ? ` از ${item.totalLimit.toLocaleString('fa-IR')}` : ''}</TableCell><TableCell className="text-left"><div className="flex flex-wrap justify-end gap-2"><Button onClick={() => onSelect(item.id)} size="sm" variant="ghost">جزئیات و ویرایش</Button>{canWrite ? <>{item.status === 'draft' || item.status === 'paused' ? <Button disabled={busy} onClick={() => onTransition(item, 'activate')} size="sm" variant="outline">فعال‌سازی</Button> : null}{item.status === 'active' ? <Button disabled={busy} onClick={() => onTransition(item, 'pause')} size="sm" variant="outline">توقف</Button> : null}{item.status !== 'ended' ? <Button disabled={busy} onClick={() => onTransition(item, 'end')} size="sm" variant="ghost">پایان</Button> : null}</> : null}</div></TableCell></TableRow>)}</TableBody></Table></div>;
}

function PromotionDetailCard({ promotionId, canWrite }: { readonly promotionId: string; readonly canWrite: boolean }) {
  const detail = useQuery(promotionQueryOptions(promotionId));
  if (detail.isPending) return <Card><CardContent className="space-y-3 py-6"><Skeleton className="h-6 w-52" /><Skeleton className="h-40" /></CardContent></Card>;
  if (detail.isError || !detail.data) return <FeedbackPanel tone="error" title="جزئیات پیشنهاد دریافت نشد">دوباره تلاش کنید یا فهرست پیشنهادها را تازه کنید.</FeedbackPanel>;

  return <PromotionDetailEditor item={detail.data} promotionId={promotionId} canWrite={canWrite} />;
}

function PromotionDetailEditor({ item, promotionId, canWrite }: { readonly item: Promotion; readonly promotionId: string; readonly canWrite: boolean }) {
  const redemptions = useQuery(promotionRedemptionsQueryOptions(promotionId));
  const categories = useQuery(categoriesQuery());
  const collections = useQuery(collectionsQuery());
  const queryClient = useQueryClient();
  const replace = useMutation({
    ...replacePromotionMutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promotionsQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: promotionsQueryKeys.detail(promotionId) });
    },
  });
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [eligibility, setEligibility] = useState<Promotion['eligibility']>(item.eligibility);
  const [code, setCode] = useState(item.code ?? '');
  const [ruleKind, setRuleKind] = useState<Promotion['rule']['kind']>(item.rule.kind);
  const [amount, setAmount] = useState(item.rule.kind === 'percentage' ? item.rule.percentage ?? '' : item.rule.amount?.amount ?? '');
  const [currency, setCurrency] = useState(item.rule.kind === 'fixed_amount' ? item.rule.amount?.currency ?? 'USD' : 'USD');
  const [targetKind, setTargetKind] = useState<'cart' | 'variants' | 'categories' | 'collections'>(item.target.kind);
  const [targetIds, setTargetIds] = useState<string[]>([...item.target.ids]);
  const [priority, setPriority] = useState(String(item.priority));
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(item.startsAt));
  const [endsAt, setEndsAt] = useState(item.endsAt ? toDateTimeLocal(item.endsAt) : '');
  const [totalLimit, setTotalLimit] = useState(item.totalLimit === null ? '' : String(item.totalLimit));
  const [perCustomerLimit, setPerCustomerLimit] = useState(item.perCustomerLimit === null ? '' : String(item.perCustomerLimit));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    const body: ReplacePromotionInput = {
      expectedVersion: item.version,
      name: name.trim(), description: description.trim() || null,
      eligibility, code: eligibility === 'code_required' ? code.trim() || null : null,
      rule: ruleKind === 'percentage' ? { kind: 'percentage', percentage: amount.trim() } : { kind: 'fixed_amount', amount: amount.trim(), currency: currency.trim().toUpperCase() },
      target: { kind: targetKind, ids: targetKind === 'cart' ? [] : targetIds },
      priority: Number(priority), startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      totalLimit: totalLimit ? Number(totalLimit) : null, perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
    };
    void replace.mutateAsync({ promotionId, body });
  };
  const addTarget = (id: string) => { if (id && !targetIds.includes(id)) setTargetIds((current) => [...current, id]); };
  return <Card className="border-primary/20"><CardHeader><CardTitle>جزئیات و ویرایش پیشنهاد</CardTitle><CardDescription>هر ذخیره، نسخه جدیدی ایجاد می‌کند و سفارش‌های قبلی را تغییر نمی‌دهد.</CardDescription></CardHeader><CardContent className="space-y-6">
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      <FormField><FieldLabel htmlFor="promotion-edit-name">نام پیشنهاد</FieldLabel><Input id="promotion-edit-name" onChange={(event) => setName(event.target.value)} value={name} /></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-eligibility">نحوه استفاده</FieldLabel><Select onValueChange={(value) => setEligibility(value as Promotion['eligibility'])} value={eligibility}><SelectTrigger id="promotion-edit-eligibility"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">برای همه مشتریان</SelectItem><SelectItem value="code_required">با کد تخفیف</SelectItem></SelectContent></Select></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-code">کد تخفیف</FieldLabel><Input dir="ltr" disabled={eligibility !== 'code_required'} id="promotion-edit-code" onChange={(event) => setCode(event.target.value)} value={code} /></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-rule">نوع تخفیف</FieldLabel><Select onValueChange={(value) => setRuleKind(value as Promotion['rule']['kind'])} value={ruleKind}><SelectTrigger id="promotion-edit-rule"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">درصدی</SelectItem><SelectItem value="fixed_amount">مبلغ ثابت</SelectItem></SelectContent></Select></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-amount">مقدار تخفیف</FieldLabel><Input dir="ltr" id="promotion-edit-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} value={amount} /></FormField>
      {ruleKind === 'fixed_amount' ? <FormField><FieldLabel htmlFor="promotion-edit-currency">واحد پول</FieldLabel><Input dir="ltr" id="promotion-edit-currency" maxLength={3} onChange={(event) => setCurrency(event.target.value)} value={currency} /></FormField> : null}
      <FormField><FieldLabel htmlFor="promotion-edit-starts">شروع</FieldLabel><Input dir="ltr" id="promotion-edit-starts" onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" value={startsAt} /></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-ends">پایان (اختیاری)</FieldLabel><Input dir="ltr" id="promotion-edit-ends" onChange={(event) => setEndsAt(event.target.value)} type="datetime-local" value={endsAt} /></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-priority">اولویت</FieldLabel><Input dir="ltr" id="promotion-edit-priority" inputMode="numeric" onChange={(event) => setPriority(event.target.value)} value={priority} /></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-total-limit">سقف استفاده کل</FieldLabel><Input dir="ltr" id="promotion-edit-total-limit" inputMode="numeric" onChange={(event) => setTotalLimit(event.target.value)} placeholder="بدون سقف" value={totalLimit} /></FormField>
      <FormField><FieldLabel htmlFor="promotion-edit-customer-limit">سقف استفاده هر مشتری</FieldLabel><Input dir="ltr" id="promotion-edit-customer-limit" inputMode="numeric" onChange={(event) => setPerCustomerLimit(event.target.value)} placeholder="بدون سقف" value={perCustomerLimit} /></FormField>
      <FormField className="md:col-span-2"><FieldLabel htmlFor="promotion-edit-description">توضیح داخلی</FieldLabel><Input id="promotion-edit-description" onChange={(event) => setDescription(event.target.value)} value={description} /></FormField>
      <FormField className="md:col-span-2"><FieldLabel htmlFor="promotion-edit-target">اعمال روی</FieldLabel><Select onValueChange={(value) => { setTargetKind(value as typeof targetKind); setTargetIds([]); }} value={targetKind}><SelectTrigger id="promotion-edit-target"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cart">کل سبد خرید</SelectItem><SelectItem value="variants">گونه‌های انتخاب‌شده</SelectItem><SelectItem value="categories">دسته‌بندی‌های انتخاب‌شده</SelectItem><SelectItem value="collections">مجموعه‌های انتخاب‌شده</SelectItem></SelectContent></Select></FormField>
      {targetKind === 'variants' ? <div className="md:col-span-2"><ProductVariantPicker onChange={addTarget} value="" /></div> : null}
      {targetKind === 'categories' ? <TargetOptionPicker label="دسته‌بندی" options={categories.data?.items ?? []} onAdd={addTarget} /> : null}
      {targetKind === 'collections' ? <TargetOptionPicker label="مجموعه" options={collections.data?.items ?? []} onAdd={addTarget} /> : null}
      {targetKind !== 'cart' ? <div className="flex flex-wrap gap-2 md:col-span-2">{targetIds.length ? targetIds.map((id) => <button className="rounded-full bg-muted px-3 py-1 text-xs" key={id} onClick={() => setTargetIds((current) => current.filter((value) => value !== id))} type="button"><bdi dir="ltr">{id}</bdi> ×</button>) : <span className="text-sm text-muted-foreground">هنوز موردی انتخاب نشده است.</span>}</div> : null}
      <div className="flex flex-wrap items-center gap-2 md:col-span-2"><Button disabled={replace.isPending} type="submit">{replace.isPending ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</Button>{replace.isError ? <span className="text-sm text-destructive">{problemMessage(replace.error, 'ذخیره انجام نشد.')}</span> : null}{replace.isSuccess ? <span className="text-sm text-success">تغییرات ذخیره شد.</span> : null}</div>
    </form>
    <section aria-labelledby="promotion-redemptions-title" className="border-t border-border pt-5"><h3 className="font-semibold" id="promotion-redemptions-title">تاریخچه استفاده</h3>{redemptions.isPending ? <Skeleton className="mt-3 h-20" /> : redemptions.data?.items.length ? <div className="mt-3 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>زمان</TableHead><TableHead>مبلغ تخفیف</TableHead><TableHead>سفارش</TableHead><TableHead>مشتری</TableHead></TableRow></TableHeader><TableBody>{redemptions.data.items.map((item) => <TableRow key={item.id}><TableCell><bdi dir="ltr">{new Date(item.redeemedAt).toLocaleString('fa-IR')}</bdi></TableCell><TableCell><bdi dir="ltr">{item.discount.amount} {item.discount.currency}</bdi></TableCell><TableCell><bdi dir="ltr">{item.orderId}</bdi></TableCell><TableCell><bdi dir="ltr">{item.customerId}</bdi></TableCell></TableRow>)}</TableBody></Table></div> : <p className="mt-2 text-sm text-muted-foreground">هنوز استفاده‌ای ثبت نشده است.</p>}</section>
  </CardContent></Card>;
}

function TargetOptionPicker({ label, options, onAdd }: { readonly label: string; readonly options: readonly { id: string; title: string }[]; readonly onAdd: (id: string) => void }) {
  return <div className="md:col-span-2"><FieldLabel htmlFor={`promotion-target-${label}`}>{`انتخاب ${label}`}</FieldLabel><Select onValueChange={onAdd}><SelectTrigger id={`promotion-target-${label}`}><SelectValue placeholder={`${label} را انتخاب کنید`} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.title}</SelectItem>)}</SelectContent></Select></div>;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function problemMessage(error: unknown, fallback: string) {
  if (isAdminApiError(error) && error.problem.kind === 'api') {
    if (error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.';
    if (error.problem.status === 409) return 'این پیشنهاد هم‌زمان تغییر کرده است؛ فهرست را تازه کنید و دوباره تلاش کنید.';
  }
  return fallback;
}
