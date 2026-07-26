import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, FileSearch, RefreshCw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isAdminApiError } from '@/api/client';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { Button } from '@/components/ui/button';
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
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-220 text-right text-sm">
              <thead className="border-b border-border bg-muted/45 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">زمان</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                  <th className="px-4 py-3 font-medium">هدف</th>
                  <th className="px-4 py-3 font-medium">انجام‌دهنده</th>
                  <th className="px-4 py-3"><span className="sr-only">جزئیات</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.data.data.map((event) => (
                  <tr className="transition-colors hover:bg-muted/40" key={event.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium"><bdi dir="ltr">{event.action}</bdi></td>
                    <td className="px-4 py-3">
                      <p><bdi dir="ltr">{event.targetType}</bdi></p>
                      <p className="mt-1 text-xs text-muted-foreground"><bdi dir="ltr">{event.targetId}</bdi></p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.actorUserId ? <bdi dir="ltr">{event.actorUserId}</bdi> : 'سامانه'}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Button aria-label={`مشاهده جزئیات رویداد ${event.action}`} onClick={() => setSelectedEvent(event)} size="sm" variant="ghost">
                        جزئیات <ChevronLeft aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {selectedEvent ? (
        <AuditDetail event={selectedEvent} onClose={() => setSelectedEvent(undefined)} />
      ) : null}
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
    <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={onSubmit}>
      <AuditField label="عملیات">
        <input className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" onChange={(event) => setFilters((value) => ({ ...value, action: event.target.value }))} placeholder="staff.roles_replaced" value={filters.action} />
      </AuditField>
      <AuditField label="نوع هدف">
        <input className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" onChange={(event) => setFilters((value) => ({ ...value, targetType: event.target.value }))} placeholder="staff" value={filters.targetType} />
      </AuditField>
      <AuditField label="شناسه هدف">
        <input className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" onChange={(event) => setFilters((value) => ({ ...value, targetId: event.target.value }))} value={filters.targetId} />
      </AuditField>
      <div className="flex items-end gap-2">
        <Button type="submit">اعمال فیلتر</Button>
        <Button onClick={() => { setFilters({ action: '', targetId: '', targetType: '' }); onApply({ action: '', targetId: '', targetType: '' }); }} type="button" variant="outline">پاک کردن</Button>
      </div>
    </form>
  );
}

function AuditField({ children, label }: { readonly children: React.ReactNode; readonly label: string }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>;
}

function AuditDetail({ event, onClose }: { readonly event: AuthorizationAuditEvent; readonly onClose: () => void }) {
  return (
    <section aria-labelledby="audit-detail-heading" className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" id="audit-detail-heading">جزئیات رویداد</h2>
          <p className="mt-1 text-sm text-muted-foreground">داده‌ها فقط برای مشاهده نمایش داده می‌شوند.</p>
        </div>
        <Button onClick={onClose} variant="outline">بستن</Button>
      </div>
      <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm md:grid-cols-2">
        <DetailItem label="شناسه رویداد"><bdi dir="ltr">{event.id}</bdi></DetailItem>
        <DetailItem label="زمان">{formatDate(event.createdAt)}</DetailItem>
        <DetailItem label="عملیات"><bdi dir="ltr">{event.action}</bdi></DetailItem>
        <DetailItem label="شناسه درخواست">{event.requestId ? <bdi dir="ltr">{event.requestId}</bdi> : 'ثبت نشده'}</DetailItem>
        <DetailItem label="نوع هدف"><bdi dir="ltr">{event.targetType}</bdi></DetailItem>
        <DetailItem label="شناسه هدف"><bdi dir="ltr">{event.targetId}</bdi></DetailItem>
        <DetailItem label="انجام‌دهنده">{event.actorUserId ? <bdi dir="ltr">{event.actorUserId}</bdi> : 'سامانه'}</DetailItem>
      </dl>
      <div className="mt-5">
        <h3 className="text-sm font-medium">فراداده</h3>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-left text-xs leading-6" dir="ltr">
          {safeJson(event.metadata)}
        </pre>
      </div>
    </section>
  );
}

function DetailItem({ children, label }: { readonly children: React.ReactNode; readonly label: string }) {
  return <div className="grid gap-1"><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{children}</dd></div>;
}

function AuditLoading() {
  return <div aria-busy="true" aria-label="در حال دریافت گزارش دسترسی‌ها" className="overflow-hidden rounded-lg border border-border bg-card"><div className="h-12 animate-pulse border-b border-border bg-muted/50" />{Array.from({ length: 5 }, (_, index) => <div className="h-16 animate-pulse border-b border-border last:border-b-0" key={index}><div className="mx-4 mt-5 h-4 w-2/3 rounded bg-muted" /></div>)}</div>;
}

function AuditEmpty() {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center"><FileSearch aria-hidden="true" className="size-8 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">رویدادی یافت نشد</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">برای این فیلترها رویداد دسترسی ثبت نشده است.</p></div>;
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
