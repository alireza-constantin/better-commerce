import { lazy } from 'react';

const loadPhaseThreeRoutes = () =>
  import('@/features/foundation/phase-three-routes');

export const OverviewRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).OverviewRoute,
}));
export const OrdersRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).OrdersRoute,
}));
export const CatalogRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).CatalogRoute,
}));
export const PricingRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).PricingRoute,
}));
export const InventoryRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).InventoryRoute,
}));
export const ShippingRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).ShippingRoute,
}));
export const StaffRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).StaffRoute,
}));
export const AuthorizationAuditRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).AuthorizationAuditRoute,
}));
export const CommerceAuditRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).CommerceAuditRoute,
}));
