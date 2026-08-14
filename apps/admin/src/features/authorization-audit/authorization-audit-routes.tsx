import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Eye, FileSearch, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isAdminApiError } from '@/api/client';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import {
  authorizationAuditListQueryOptions,
  type AuthorizationAuditEvent,
} from './api';

const PAGE_LIMIT = 25;
const authorizationAuditRouteApi = getRouteApi('/audit/authorization');

interface AuthorizationAuditSearch {
  readonly action?: string;
  readonly cursor?: string;
  readonly history?: readonly string[];
  readonly targetId?: string;
  readonly targetType?: string;
}

/** Lazy-route-ready, read-only authorization audit entry point. */
export function AuthorizationAuditRoute() {
  return (
    <PermissionBoundary required={adminRoutes.authorizationAudit.permissions}>
      <AuthorizationAuditContent />
    </PermissionBoundary>
  );
}

function AuthorizationAuditContent() {
  const rawSearch: unknown = authorizationAuditRouteApi.useSearch();
  const search = normalizeSearch(rawSearch);
  const navigate = authorizationAuditRouteApi.useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<AuthorizationAuditEvent>();
  const events = useQuery(
    authorizationAuditListQueryOptions({
      action: search.action,
      cursor: search.cursor,
      limit: PAGE_LIMIT,
      targetId: search.targetId,
      targetType: search.targetType,
    }),
  );

  const updateSearch = (next: AuthorizationAuditSearch) => {
    void navigate({
      to: adminRoutes.authorizationAudit.path,
      search: next,
    });
  };

  const applyFilters = (filters: AuditFilters) => {
    setSelectedEvent(undefined);
    updateSearch({
      action: emptyToUndefined(filters.action),
      history: [],
      targetId: emptyToUndefined(filters.targetId),
      targetType: emptyToUndefined(filters.targetType),
    });
  };

  const goToCursor = (cursor: string | undefined, history: readonly string[]) => {
    setSelectedEvent(undefined);
    updateSearch({ ...search, cursor, history });
  };

  return (
    <section aria-labelledby="authorization-audit-heading" className="space-y-5" dir="rtl">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]" id="authorization-audit-heading">
          گزارش دسترسی‌ها
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          رویدادهای موفق تغییر دسترسی و کارکنان را بررسی کنید.
        </p>
      </header>

      <AuditFiltersForm
        initial={search}
        key={`${search.action ?? ''}:${search.targetType ?? ''}:${search.targetId ?? ''}`}
        onApply={applyFilters}
      />

      {events.isPending ? <AuditLoading /> : null}
      {events.isError ? (
        <AuditProblem error={events.error} onRetry={() => void events.refetch()} />
      ) : null}
      {events.data && events.data.data.length === 0 ? <AuditEmpty /> : null}
      {events.data && events.data.data.length > 0 ? (
        <>
          <div className="grid gap-3 md:hidden">
            {events.data.data.map((event) => <Card key={event.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium"><bdi dir="ltr">{event.action}</bdi></p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)}</p></div><Button aria-label={`مشاهده جزئیات رویداد ${event.action}`} onClick={() => setSelectedEvent(event)} size="icon" variant="ghost"><Eye /></Button></div><div className="grid grid-cols-2 gap-3 text-sm"><CompactValue label="نوع هدف" value={event.targetType} /><CompactValue label="انجام‌دهنده" value={event.actorUserId} emptyLabel="سامانه" /></div></CardContent></Card>)}
          </div>
          <Card className="hidden md:block"><Table><TableHeader><TableRow><TableHead scope="col">زمان</TableHead><TableHead scope="col">عملیات</TableHead><TableHead scope="col">هدف</TableHead><TableHead scope="col">انجام‌دهنده</TableHead><TableHead scope="col"><span className="sr-only">جزئیات</span></TableHead></TableRow></TableHeader><TableBody>{events.data.data.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(event.createdAt)}</TableCell><TableCell className="font-medium"><bdi dir="ltr">{event.action}</bdi></TableCell><TableCell className="max-w-56"><p><bdi dir="ltr">{event.targetType}</bdi></p><p className="mt-1 truncate text-xs text-muted-foreground" title={event.targetId}><bdi dir="ltr">{event.targetId}</bdi></p></TableCell><TableCell className="max-w-48 truncate text-muted-foreground">{event.actorUserId ? <bdi dir="ltr" title={event.actorUserId}>{event.actorUserId}</bdi> : 'سامانه'}</TableCell><TableCell><Button aria-label={`مشاهده جزئیات رویداد ${event.action}`} onClick={() => setSelectedEvent(event)} size="sm" variant="ghost"><Eye /> جزئیات</Button></TableCell></TableRow>)}</TableBody></Table></Card>
          <nav aria-label="صفحه‌بندی گزارش دسترسی‌ها" className="flex items-center justify-between gap-3">
            <Button disabled={search.history.length === 0 || events.isFetching} onClick={() => {
              const history = [...search.history];
              const previous = history.pop();
              goToCursor(previous || undefined, history);
            }} variant="outline">
              <ChevronRight aria-hidden="true" /> صفحه پیشین
            </Button>
            <Button disabled={!events.data.nextCursor || events.isFetching} onClick={() => {
              goToCursor(events.data.nextCursor ?? undefined, [
                ...search.history,
                search.cursor ?? '',
              ]);
            }} variant="outline">
              صفحه بعد <ChevronLeft aria-hidden="true" />
            </Button>
          </nav>
        </>
      ) : null}

      <AuditDetail event={selectedEvent} onClose={() => setSelectedEvent(undefined)} />
    </section>
  );
}

interface AuditFilters {
  readonly action: string;
  readonly targetId: string;
  readonly targetType: string;
}

function AuditFiltersForm({ initial, onApply }: { readonly initial: AuthorizationAuditSearch; readonly onApply: (filters: AuditFilters) => void }) {
  const [filters, setFilters] = useState<AuditFilters>(() => toFilters(initial));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(filters);
  };

  return (
    <Card><CardContent><form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={onSubmit}>
      <AuditField label="عملیات">
        <Input dir="ltr" onChange={(event) => setFilters((value) => ({ ...value, action: event.target.value }))} placeholder="staff.roles_replaced" value={filters.action} />
      </AuditField>
      <AuditField label="نوع هدف">
        <Input dir="ltr" onChange={(event) => setFilters((value) => ({ ...value, targetType: event.target.value }))} placeholder="staff" value={filters.targetType} />
      </AuditField>
      <AuditField label="شناسه هدف">
        <Input dir="ltr" onChange={(event) => setFilters((value) => ({ ...value, targetId: event.target.value }))} value={filters.targetId} />
      </AuditField>
      <div className="flex items-end gap-2">
        <Button type="submit">اعمال فیلتر</Button>
        <Button onClick={() => { setFilters({ action: '', targetId: '', targetType: '' }); onApply({ action: '', targetId: '', targetType: '' }); }} type="button" variant="outline">پاک کردن</Button>
      </div>
    </form></CardContent></Card>
  );
}

function AuditField({ children, label }: { readonly children: React.ReactNode; readonly label: string }) {
  return <Field><FieldLabel>{label}</FieldLabel>{children}</Field>;
}

function AuditDetail({ event, onClose }: { readonly event?: AuthorizationAuditEvent; readonly onClose: () => void }) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>جزئیات رویداد</DialogTitle><DialogDescription>داده‌ها فقط برای پیگیری و بررسی نمایش داده می‌شوند.</DialogDescription></DialogHeader>{event ? <><dl className="grid gap-x-6 gap-y-4 text-sm md:grid-cols-2">
        <DetailItem label="شناسه رویداد"><bdi dir="ltr">{event.id}</bdi></DetailItem>
        <DetailItem label="زمان">{formatDate(event.createdAt)}</DetailItem>
        <DetailItem label="عملیات"><bdi dir="ltr">{event.action}</bdi></DetailItem>
        <DetailItem label="شناسه درخواست">{event.requestId ? <bdi dir="ltr">{event.requestId}</bdi> : 'ثبت نشده'}</DetailItem>
        <DetailItem label="نوع هدف"><bdi dir="ltr">{event.targetType}</bdi></DetailItem>
        <DetailItem label="شناسه هدف"><bdi dir="ltr">{event.targetId}</bdi></DetailItem>
        <DetailItem label="انجام‌دهنده">{event.actorUserId ? <bdi dir="ltr">{event.actorUserId}</bdi> : 'سامانه'}</DetailItem>
      </dl><div className="mt-5">
        <h3 className="text-sm font-medium">فراداده</h3>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-left text-xs leading-6" dir="ltr">
          {safeJson(event.metadata)}
        </pre>
      </div></> : null}</DialogContent></Dialog>
  );
}

function DetailItem({ children, label }: { readonly children: React.ReactNode; readonly label: string }) {
  return <div className="grid gap-1"><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{children}</dd></div>;
}

function CompactValue({ label, value, emptyLabel = '—' }: { readonly label: string; readonly value: string | null; readonly emptyLabel?: string }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate" title={value ?? undefined}><bdi dir="ltr">{value ?? emptyLabel}</bdi></p></div>; }

function AuditLoading() {
  return <Card aria-busy="true" aria-label="در حال دریافت گزارش دسترسی‌ها" className="space-y-2 p-4">{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-12" key={index} />)}</Card>;
}

function AuditEmpty() {
  return <Empty className="min-h-64 border"><EmptyHeader><EmptyMedia variant="icon"><FileSearch /></EmptyMedia><EmptyTitle>رویدادی یافت نشد</EmptyTitle><EmptyDescription>برای این فیلترها رویداد دسترسی ثبت نشده است.</EmptyDescription></EmptyHeader></Empty>;
}

function AuditProblem({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) {
  const requestId = isAdminApiError(error) && 'requestId' in error.problem ? error.problem.requestId : undefined;
  return <div className="rounded-lg border border-destructive/25 bg-card px-5 py-6" role="alert"><h2 className="font-semibold">دریافت گزارش انجام نشد</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{errorMessage(error)}</p>{requestId ? <p className="mt-2 text-xs text-muted-foreground">شناسه درخواست: <bdi dir="ltr">{requestId}</bdi></p> : null}<Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button></div>;
}

function normalizeSearch(value: unknown): Required<Pick<AuthorizationAuditSearch, 'history'>> & AuthorizationAuditSearch {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    action: readString(source.action),
    cursor: readString(source.cursor),
    history: Array.isArray(source.history) ? source.history.filter((item): item is string => typeof item === 'string') : [],
    targetId: readString(source.targetId),
    targetType: readString(source.targetType),
  };
}

function readString(value: unknown) { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function emptyToUndefined(value: string) { const trimmed = value.trim(); return trimmed.length > 0 ? trimmed : undefined; }
function toFilters(search: AuthorizationAuditSearch): AuditFilters { return { action: search.action ?? '', targetId: search.targetId ?? '', targetType: search.targetType ?? '' }; }
function safeJson(value: unknown) { try { return JSON.stringify(value, null, 2); } catch { return 'داده قابل نمایش نیست'; } }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date); }
function errorMessage(error: unknown) { if (isAdminApiError(error) && error.problem.kind === 'api' && error.problem.status === 403) return 'حساب شما اجازه مشاهده این گزارش را ندارد.'; if (isAdminApiError(error) && error.problem.kind === 'api' && error.problem.status === 400) return 'فیلتر یا صفحه درخواستی معتبر نیست. فیلترها را بررسی کنید.'; return 'پاسخ معتبری از سرویس گزارش دسترسی‌ها دریافت نشد. دوباره تلاش کنید.'; }
