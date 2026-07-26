import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { isAdminApiError } from '@/api/client';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { CommerceAuditEvents } from './components';
import { commerceAuditListQueryOptions } from './api';

const PAGE_LIMIT = 25;
const commerceAuditRouteApi = getRouteApi('/audit/commerce');

/** Lazy-ready, read-only route for commerce audit history. */
export function CommerceAuditRoute() {
  return (
    <PermissionBoundary required={adminRoutes.commerceAudit.permissions}>
      <CommerceAuditRouteContent />
    </PermissionBoundary>
  );
}

function CommerceAuditRouteContent() {
  const search = commerceAuditRouteApi.useSearch();
  const navigate = commerceAuditRouteApi.useNavigate();
  const cursor = search.cursor;
  const history = search.history ?? [];
  const auditEvents = useQuery(
    commerceAuditListQueryOptions({ cursor, limit: PAGE_LIMIT }),
  );

  const goNext = () => {
    const nextCursor = auditEvents.data?.nextCursor;
    if (!nextCursor) return;
    void navigate({
      to: adminRoutes.commerceAudit.path,
      search: (current) => ({
        ...current,
        cursor: nextCursor,
        history: [...history, cursor ?? ''],
      }),
    });
  };

  const goPrevious = () => {
    if (history.length === 0) return;
    const nextHistory = [...history];
    const previousCursor = nextHistory.pop();
    void navigate({
      to: adminRoutes.commerceAudit.path,
      search: (current) => ({
        ...current,
        cursor: previousCursor || undefined,
        history: nextHistory,
      }),
    });
  };

  return (
    <CommerceAuditEvents
      error={auditEvents.isError ? auditErrorMessage(auditEvents.error) : undefined}
      hasPreviousPage={history.length > 0}
      isFetching={auditEvents.isFetching}
      isLoading={auditEvents.isPending}
      onNextPage={auditEvents.data?.nextCursor ? goNext : undefined}
      onPreviousPage={history.length > 0 ? goPrevious : undefined}
      onRetry={() => { void auditEvents.refetch(); }}
      page={auditEvents.data}
    />
  );
}

function auditErrorMessage(error: unknown) {
  if (isAdminApiError(error) && error.problem.kind === 'api') {
    if (error.problem.status === 403) return 'حساب شما اجازه مشاهدهٔ رویدادهای ممیزی را ندارد.';
    if (error.problem.status === 400) return 'شناسهٔ صفحه معتبر نیست. از ابتدا دوباره تلاش کنید.';
  }
  return 'پاسخ معتبری از سرویس ممیزی فروشگاه دریافت نشد. دوباره تلاش کنید.';
}
