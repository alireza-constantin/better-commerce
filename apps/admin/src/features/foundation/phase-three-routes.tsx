import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { FeaturePlaceholderPage } from './feature-placeholder-page';
import { OverviewPage } from './overview-page';

export function OverviewRoute() {
  return (
    <PermissionBoundary required={adminRoutes.overview.permissions}>
      <OverviewPage />
    </PermissionBoundary>
  );
}

export function OrdersRoute() {
  return (
    <PermissionBoundary required={adminRoutes.orders.permissions}>
      <FeaturePlaceholderPage
        description="مشاهده و مدیریت سفارش‌های ثبت‌شده در فروشگاه."
        title="سفارش‌ها"
      />
    </PermissionBoundary>
  );
}

export function CatalogRoute() {
  return (
    <PermissionBoundary required={adminRoutes.catalog.permissions}>
      <FeaturePlaceholderPage
        description="مدیریت محصولات و اطلاعات کاتالوگ فروشگاه."
        title="کاتالوگ"
      />
    </PermissionBoundary>
  );
}

export function PricingRoute() {
  return (
    <PermissionBoundary required={adminRoutes.pricing.permissions}>
      <FeaturePlaceholderPage
        description="مشاهده و مدیریت قواعد قیمت‌گذاری فروشگاه."
        title="قیمت‌گذاری"
      />
    </PermissionBoundary>
  );
}

export function InventoryRoute() {
  return (
    <PermissionBoundary required={adminRoutes.inventory.permissions}>
      <FeaturePlaceholderPage
        description="مشاهده موجودی و وضعیت نگه‌داری کالاها."
        title="موجودی"
      />
    </PermissionBoundary>
  );
}

export function ShippingRoute() {
  return (
    <PermissionBoundary required={adminRoutes.shipping.permissions}>
      <FeaturePlaceholderPage
        description="مدیریت روش‌ها، محدوده‌ها و قواعد هزینه ارسال."
        title="ارسال"
      />
    </PermissionBoundary>
  );
}

export function StaffRoute() {
  return (
    <PermissionBoundary required={adminRoutes.staff.permissions}>
      <FeaturePlaceholderPage
        description="مشاهده کارکنان و دسترسی‌های اختصاص‌یافته به آن‌ها."
        title="کارکنان"
      />
    </PermissionBoundary>
  );
}

export function AuthorizationAuditRoute() {
  return (
    <PermissionBoundary required={adminRoutes.authorizationAudit.permissions}>
      <FeaturePlaceholderPage
        description="بررسی رویدادهای مرتبط با مدیریت دسترسی کارکنان."
        title="ممیزی دسترسی"
      />
    </PermissionBoundary>
  );
}

export function CommerceAuditRoute() {
  return (
    <PermissionBoundary required={adminRoutes.commerceAudit.permissions}>
      <FeaturePlaceholderPage
        description="بررسی رویدادهای ثبت‌شده از عملیات مهم فروشگاه."
        title="ممیزی فروشگاه"
      />
    </PermissionBoundary>
  );
}
