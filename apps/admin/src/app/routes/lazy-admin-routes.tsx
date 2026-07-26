import { lazy } from 'react';

const loadPhaseThreeRoutes = () =>
  import('@/features/foundation/phase-three-routes');

export const OverviewRoute = lazy(async () => ({
  default: (await loadPhaseThreeRoutes()).OverviewRoute,
}));
export const OrdersRoute = lazy(async () => ({
  default: (await import('@/features/orders/orders-routes')).OrdersRoute,
}));
export const OrderDetailRoute = lazy(async () => ({
  default: (await import('@/features/orders/orders-routes')).OrderDetailRoute,
}));
export const CatalogRoute = lazy(async () => ({
  default: (await import('@/features/catalog/catalog-routes')).CatalogRoute,
}));
export const PricingRoute = lazy(async () => ({
  default: (await import('@/features/pricing/pricing-routes')).PricingRoute,
}));
export const InventoryRoute = lazy(async () => ({
  default: (await import('@/features/inventory/inventory-routes')).InventoryRoute,
}));
export const ShippingRoute = lazy(async () => ({
  default: (await import('@/features/shipping/shipping-routes')).ShippingRoute,
}));
export const StaffRoute = lazy(async () => ({
  default: (await import('@/features/staff/staff-routes')).StaffRoute,
}));
export const AuthorizationAuditRoute = lazy(async () => ({
  default: (
    await import(
      '@/features/authorization-audit/authorization-audit-routes'
    )
  ).AuthorizationAuditRoute,
}));
export const CommerceAuditRoute = lazy(async () => ({
  default: (
    await import('@/features/commerce-audit/commerce-audit-route')
  ).CommerceAuditRoute,
}));
