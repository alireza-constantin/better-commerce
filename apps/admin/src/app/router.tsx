import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { NotFoundPage } from '@/features/foundation/not-found-page';
import { AdminRoot } from './admin-root';
import { adminRoutes, type AdminRoutePath } from './routes/admin-route-contract';
import {
  AuthorizationAuditRoute,
  CatalogRoute,
  CommerceAuditRoute,
  InventoryRoute,
  OrderDetailRoute,
  OrdersRoute,
  OverviewRoute,
  PricingRoute,
  ShippingRoute,
  StaffRoute,
} from './routes/lazy-admin-routes';

const rootRoute = createRootRoute({
  component: AdminRoot,
  notFoundComponent: NotFoundPage,
});

interface OrdersNavigationSearch {
  readonly cursor?: string;
  readonly history?: readonly string[];
  readonly returnCursor?: string;
  readonly returnHistory?: readonly string[];
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function protectedRoute<const TPath extends AdminRoutePath>(
  path: TPath,
  component: React.LazyExoticComponent<() => React.JSX.Element>,
) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component,
  });
}

const routeTree = rootRoute.addChildren([
  protectedRoute(adminRoutes.overview.path, OverviewRoute),
  createRoute({
    getParentRoute: () => rootRoute,
    path: adminRoutes.orders.path,
    component: OrdersRoute,
    validateSearch: (search): OrdersNavigationSearch => ({
      cursor: stringValue(search.cursor),
      history: stringArray(search.history),
      returnCursor: stringValue(search.returnCursor),
      returnHistory: stringArray(search.returnHistory),
    }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: adminRoutes.orderDetail.path,
    component: OrderDetailRoute,
    validateSearch: (search): OrdersNavigationSearch => ({
      cursor: stringValue(search.cursor),
      history: stringArray(search.history),
      returnCursor: stringValue(search.returnCursor),
      returnHistory: stringArray(search.returnHistory),
    }),
  }),
  protectedRoute(adminRoutes.catalog.path, CatalogRoute),
  protectedRoute(adminRoutes.pricing.path, PricingRoute),
  protectedRoute(adminRoutes.inventory.path, InventoryRoute),
  protectedRoute(adminRoutes.shipping.path, ShippingRoute),
  protectedRoute(adminRoutes.staff.path, StaffRoute),
  protectedRoute(
    adminRoutes.authorizationAudit.path,
    AuthorizationAuditRoute,
  ),
  protectedRoute(adminRoutes.commerceAudit.path, CommerceAuditRoute),
]);

export const router = createRouter({
  routeTree,
  basepath: '/admin',
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
