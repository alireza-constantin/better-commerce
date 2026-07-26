import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { OverviewPage } from './overview-page';

export function OverviewRoute() {
  return (
    <PermissionBoundary required={adminRoutes.overview.permissions}>
      <OverviewPage />
    </PermissionBoundary>
  );
}
