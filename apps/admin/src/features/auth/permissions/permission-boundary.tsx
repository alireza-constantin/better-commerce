import type { ReactNode } from 'react';
import { hasAllPermissions, type AdminPermission } from './permissions';
import { useAdminSession } from '../session/use-admin-session';

interface PermissionBoundaryProps {
  readonly children: ReactNode;
  readonly required: readonly AdminPermission[];
}

export function PermissionBoundary({
  children,
  required,
}: PermissionBoundaryProps) {
  const profile = useAdminSession();

  if (!hasAllPermissions(profile.permissions, required)) {
    return <RouteAccessDenied />;
  }

  return children;
}

function RouteAccessDenied() {
  return (
    <section className="mx-auto max-w-2xl py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground" dir="ltr">
        403
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        دسترسی به این بخش امکان‌پذیر نیست
      </h1>
      <p className="mt-4 leading-7 text-muted-foreground">
        حساب شما مجوز لازم برای مشاهده این صفحه را ندارد. اگر به این بخش نیاز
        دارید، از مدیر فروشگاه بخواهید دسترسی شما را بررسی کند.
      </p>
    </section>
  );
}
