import {
  BadgeDollarSign,
  Boxes,
  LayoutDashboard,
  PackageSearch,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { AdminPermission } from '@/features/auth/permissions/permissions';
import {
  adminRoutes,
  type AdminRoutePath,
} from '@/app/routes/admin-route-contract';

export interface AdminNavigationItem {
  readonly label: string;
  readonly path: AdminRoutePath;
  readonly permissions: readonly AdminPermission[];
  readonly icon: LucideIcon;
}

export interface AdminNavigationGroup {
  readonly label: string;
  readonly items: readonly AdminNavigationItem[];
}

/**
 * The shell uses this declarative model for its visible navigation. It has no
 * role knowledge: callers must evaluate these exact server-returned
 * permissions before showing an item or admitting its route.
 */
export const adminNavigation: readonly AdminNavigationGroup[] = [
  {
    label: 'فضای کاری',
    items: [
      {
        label: 'نمای کلی',
        ...adminRoutes.overview,
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'عملیات فروشگاه',
    items: [
      {
        label: 'سفارش‌ها',
        ...adminRoutes.orders,
        icon: ShoppingBag,
      },
      {
        label: 'کاتالوگ',
        ...adminRoutes.catalog,
        icon: PackageSearch,
      },
      {
        label: 'قیمت‌گذاری',
        ...adminRoutes.pricing,
        icon: BadgeDollarSign,
      },
      {
        label: 'موجودی',
        ...adminRoutes.inventory,
        icon: Boxes,
      },
      {
        label: 'ارسال',
        ...adminRoutes.shipping,
        icon: Truck,
      },
    ],
  },
  {
    label: 'مدیریت دسترسی',
    items: [
      {
        label: 'کارکنان',
        ...adminRoutes.staff,
        icon: UsersRound,
      },
      {
        label: 'ممیزی دسترسی',
        ...adminRoutes.authorizationAudit,
        icon: ShieldCheck,
      },
      {
        label: 'ممیزی فروشگاه',
        ...adminRoutes.commerceAudit,
        icon: ScrollText,
      },
    ],
  },
] as const;
