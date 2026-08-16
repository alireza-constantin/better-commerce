import {
  BadgeDollarSign,
  Boxes,
  FolderTree,
  LayoutDashboard,
  Megaphone,
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

type AdminNavigationPath = Exclude<AdminRoutePath, '/orders/$orderId'>;

export interface AdminNavigationItem {
  readonly label: string;
  readonly path: AdminNavigationPath;
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
    label: 'نمای کلی',
    items: [
      {
        label: 'نمای کلی',
        ...adminRoutes.overview,
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'فروش',
    items: [
      {
        label: 'سفارش‌ها',
        ...adminRoutes.orders,
        icon: ShoppingBag,
      },
    ],
  },
  {
    label: 'محصولات',
    items: [
      {
        label: 'کاتالوگ',
        ...adminRoutes.catalog,
        icon: PackageSearch,
      },
      {
        label: 'دسته‌بندی‌ها',
        ...adminRoutes.categories,
        icon: FolderTree,
      },
      {
        label: 'مجموعه‌ها',
        ...adminRoutes.collections,
        icon: FolderTree,
      },
    ],
  },
  {
    label: 'عملیات',
    items: [
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
        label: 'تخفیف‌ها و کمپین‌ها',
        ...adminRoutes.promotions,
        icon: Megaphone,
      },
      {
        label: 'ارسال',
        ...adminRoutes.shipping,
        icon: Truck,
      },
    ],
  },
  {
    label: 'تیم و امنیت',
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
