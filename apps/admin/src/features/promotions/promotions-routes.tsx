import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isAdminApiError } from '@/api/client';
import {
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
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import {
  createPromotionMutationOptions,
  promotionsListQueryOptions,
  promotionsQueryKeys,
  transitionPromotionMutationOptions,
} from './api/promotions-query';
import type { CreatePromotionInput, Promotion } from './api/promotions-api';

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
          {promotions.data && promotions.data.items.length > 0 ? <PromotionTable items={promotions.data.items} canWrite={canWrite} busy={transition.isPending} onTransition={(item, action) => { void transition.mutateAsync({ promotionId: item.id, action, body: { expectedVersion: item.version } }); }} /> : null}
        </CardContent>
      </Card>
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

function PromotionTable({ items, canWrite, busy, onTransition }: { readonly items: readonly Promotion[]; readonly canWrite: boolean; readonly busy: boolean; readonly onTransition: (item: Promotion, action: 'activate' | 'pause' | 'end') => void }) {
  return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>پیشنهاد</TableHead><TableHead>وضعیت</TableHead><TableHead>قانون</TableHead><TableHead>استفاده</TableHead><TableHead className="text-left">عملیات</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.eligibility === 'code_required' ? <bdi dir="ltr">{item.code || 'کد ثبت نشده'}</bdi> : 'عمومی'}</div></TableCell><TableCell><StatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</StatusBadge></TableCell><TableCell>{item.rule.kind === 'percentage' ? `${item.rule.percentage ?? '۰'}٪` : item.rule.amount ? <bdi dir="ltr">{item.rule.amount.amount} {item.rule.amount.currency}</bdi> : 'مبلغ ثابت'}</TableCell><TableCell>{item.redemptions.total.toLocaleString('fa-IR')}{item.totalLimit ? ` از ${item.totalLimit.toLocaleString('fa-IR')}` : ''}</TableCell><TableCell className="text-left">{canWrite ? <div className="flex justify-end gap-2">{item.status === 'draft' || item.status === 'paused' ? <Button disabled={busy} onClick={() => onTransition(item, 'activate')} size="sm" variant="outline">فعال‌سازی</Button> : null}{item.status === 'active' ? <Button disabled={busy} onClick={() => onTransition(item, 'pause')} size="sm" variant="outline">توقف</Button> : null}{item.status !== 'ended' ? <Button disabled={busy} onClick={() => onTransition(item, 'end')} size="sm" variant="ghost">پایان</Button> : null}</div> : 'فقط مشاهده'}</TableCell></TableRow>)}</TableBody></Table></div>;
}

function problemMessage(error: unknown, fallback: string) {
  if (isAdminApiError(error) && error.problem.kind === 'api') {
    if (error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.';
    if (error.problem.status === 409) return 'این پیشنهاد هم‌زمان تغییر کرده است؛ فهرست را تازه کنید و دوباره تلاش کنید.';
  }
  return fallback;
}
