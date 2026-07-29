import type { AdminPermission } from '@/features/auth/permissions/permissions';

interface AdminRouteContract {
  readonly path: string;
  readonly permissions: readonly AdminPermission[];
}

/**
 * One source of truth for route paths and client-side permission affordances.
 * The API remains the security authority for every protected request.
 */
export const adminRoutes = {
  overview: {
    path: '/',
    permissions: ['admin.access'],
  },
  orders: {
    path: '/orders',
    permissions: ['orders.read'],
  },
  orderDetail: {
    path: '/orders/$orderId',
    permissions: ['orders.read'],
  },
  catalog: {
    path: '/catalog',
    permissions: ['catalog.products.read'],
  },
  categories: {
    path: '/catalog/categories',
    permissions: ['catalog.categories.read'],
  },
  collections: {
    path: '/catalog/collections',
    permissions: ['catalog.collections.read'],
  },
  pricing: {
    path: '/pricing',
    permissions: ['pricing.read'],
  },
  inventory: {
    path: '/inventory',
    permissions: ['inventory.read'],
  },
  shipping: {
    path: '/shipping',
    permissions: ['shipping.read'],
  },
  staff: {
    path: '/staff',
    permissions: ['staff.read'],
  },
  authorizationAudit: {
    path: '/audit/authorization',
    permissions: ['audit.read'],
  },
  commerceAudit: {
    path: '/audit/commerce',
    permissions: ['audit.read'],
  },
} as const satisfies Record<string, AdminRouteContract>;

export type AdminRoutePath =
  (typeof adminRoutes)[keyof typeof adminRoutes]['path'];
