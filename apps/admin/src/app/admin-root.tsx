import { Outlet, useRouterState } from '@tanstack/react-router';
import { Suspense } from 'react';
import { AdminBootstrap } from '@/features/auth/admin-bootstrap';
import { LogoutButton } from '@/features/auth/logout-button';
import { hasAllPermissions } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminNavigation } from './navigation';
import { AdminShell } from './shell';

export function AdminRoot() {
  return (
    <AdminBootstrap>
      <AuthenticatedAdminRoot />
    </AdminBootstrap>
  );
}

function AuthenticatedAdminRoot() {
  const profile = useAdminSession();
  const routerPath = useRouterState({
    select: (state) => state.location.pathname,
  });
  const activePath = routerPath.startsWith('/admin')
    ? routerPath.slice('/admin'.length) || '/'
    : routerPath;
  const visibleNavigation = adminNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        hasAllPermissions(profile.permissions, item.permissions),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const permissionCount = profile.permissions.length.toLocaleString('fa-IR');

  return (
    <AdminShell
      activePath={activePath}
      logoutAction={<LogoutButton />}
      navigation={visibleNavigation}
      staff={{
        email: profile.email,
        profileSummary: `${permissionCount} دسترسی فعال`,
      }}
    >
      <Suspense
        fallback={
          <p aria-live="polite" className="py-12 text-sm text-muted-foreground">
            در حال بارگذاری بخش…
          </p>
        }
      >
        <Outlet />
      </Suspense>
    </AdminShell>
  );
}
