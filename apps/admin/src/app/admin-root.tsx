import { Outlet } from '@tanstack/react-router';
import { AdminBootstrap } from '@/features/auth/admin-bootstrap';

export function AdminRoot() {
  return (
    <AdminBootstrap>
      <Outlet />
    </AdminBootstrap>
  );
}
