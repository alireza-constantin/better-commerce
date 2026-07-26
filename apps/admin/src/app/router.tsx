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

function protectedRoute(
  path: AdminRoutePath,
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
  protectedRoute(adminRoutes.orders.path, OrdersRoute),
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
