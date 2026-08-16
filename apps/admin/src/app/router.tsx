import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { NotFoundPage } from '@/features/foundation/not-found-page';
import { AdminRoot } from './admin-root';
import {
  adminRoutes,
  type AdminRoutePath,
} from './routes/admin-route-contract';
import {
  AuthorizationAuditRoute,
  CatalogRoute,
  CategoriesRoute,
  CollectionsRoute,
  CommerceAuditRoute,
  InventoryRoute,
  OrderDetailRoute,
  OrdersRoute,
  OverviewRoute,
  PricingRoute,
  PromotionsRoute,
  ShippingRoute,
  StaffRoute,
} from './routes/lazy-admin-routes';

const rootRoute = createRootRoute({
  component: AdminRoot,
  notFoundComponent: NotFoundPage,
});

interface AdminNavigationSearch {
  readonly cursor?: string;
  readonly history?: readonly string[];
  readonly returnCursor?: string;
  readonly returnHistory?: readonly string[];
  readonly q?: string;
  readonly sku?: string;
  readonly status?: 'draft' | 'published' | 'archived';
  readonly product?: string;
  readonly tab?: 'general' | 'organization' | 'media' | 'variants' | 'activity';
  readonly create?: boolean;
  readonly action?: string;
  readonly targetType?: string;
  readonly targetId?: string;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function catalogStatus(value: unknown) {
  return value === 'draft' || value === 'published' || value === 'archived'
    ? value
    : undefined;
}

function productTab(value: unknown): AdminNavigationSearch['tab'] {
  return value === 'general' ||
    value === 'organization' ||
    value === 'media' ||
    value === 'variants' ||
    value === 'activity'
    ? value
    : undefined;
}

function adminNavigationSearch(
  search: Record<string, unknown>,
): AdminNavigationSearch {
  return {
    cursor: stringValue(search.cursor),
    history: stringArray(search.history),
    returnCursor: stringValue(search.returnCursor),
    returnHistory: stringArray(search.returnHistory),
    q: stringValue(search.q),
    sku: stringValue(search.sku),
    status: catalogStatus(search.status),
    product: stringValue(search.product),
    tab: productTab(search.tab),
    create: search.create === true ? true : undefined,
    action: stringValue(search.action),
    targetType: stringValue(search.targetType),
    targetId: stringValue(search.targetId),
  };
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
    validateSearch: adminNavigationSearch,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: adminRoutes.orderDetail.path,
    component: OrderDetailRoute,
    validateSearch: adminNavigationSearch,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: adminRoutes.catalog.path,
    component: CatalogRoute,
    validateSearch: adminNavigationSearch,
  }),
  protectedRoute(adminRoutes.categories.path, CategoriesRoute),
  protectedRoute(adminRoutes.collections.path, CollectionsRoute),
  protectedRoute(adminRoutes.pricing.path, PricingRoute),
  protectedRoute(adminRoutes.inventory.path, InventoryRoute),
  protectedRoute(adminRoutes.promotions.path, PromotionsRoute),
  protectedRoute(adminRoutes.shipping.path, ShippingRoute),
  createRoute({
    getParentRoute: () => rootRoute,
    path: adminRoutes.staff.path,
    component: StaffRoute,
    validateSearch: adminNavigationSearch,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: adminRoutes.authorizationAudit.path,
    component: AuthorizationAuditRoute,
    validateSearch: adminNavigationSearch,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: adminRoutes.commerceAudit.path,
    component: CommerceAuditRoute,
    validateSearch: adminNavigationSearch,
  }),
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
