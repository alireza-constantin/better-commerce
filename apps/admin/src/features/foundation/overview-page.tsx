import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Boxes, PackageSearch, ShoppingBag } from 'lucide-react';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { adminProductsListQueryOptions } from '@/features/catalog/api';
import { adminOrdersListQueryOptions } from '@/features/orders/api';

export function OverviewPage() {
  const orders = useQuery(adminOrdersListQueryOptions({ limit: 8 }));
  const products = useQuery(adminProductsListQueryOptions({ limit: 8 }));
  const pendingOrders = (orders.data?.items ?? []).filter(
    (order) =>
      order.status === 'submitted' ||
      ['pending_manual_review', 'pending_collection'].includes(order.paymentStatus),
  );
  const draftProducts = (products.data?.items ?? []).filter(
    (product) => product.status === 'draft',
  );

  return (
    <section className="mx-auto flex max-w-[90rem] flex-col gap-5" dir="rtl">
      <header className="border-b border-border pb-4">
        <p className="text-sm font-medium text-primary">فضای کاری امروز</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">نمای کلی فروشگاه</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          کارهایی که اکنون به توجه کارکنان نیاز دارند، بدون آمار ساختگی یا نمایشی.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          description="سفارش ثبت‌شده یا پرداخت نیازمند بررسی در تازه‌ترین صفحه"
          icon={ShoppingBag}
          loading={orders.isPending}
          tone={pendingOrders.length ? 'warning' : 'success'}
          value={pendingOrders.length}
          label="سفارش نیازمند اقدام"
        />
        <MetricCard
          description="کالای منتشرنشده در تازه‌ترین صفحه کاتالوگ"
          icon={PackageSearch}
          loading={products.isPending}
          tone={draftProducts.length ? 'warning' : 'neutral'}
          value={draftProducts.length}
          label="پیش‌نویس کالا"
        />
        <MetricCard
          description="کالاهای دیده‌شده در تازه‌ترین صفحه؛ نه کل فروشگاه"
          icon={Boxes}
          loading={products.isPending}
          tone="neutral"
          value={products.data?.items.length ?? 0}
          label="کالای تازه بررسی‌شده"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>صف سفارش‌ها</CardTitle>
              <CardDescription>مواردی که احتمالاً به بررسی پرداخت یا تصمیم سفارش نیاز دارند.</CardDescription>
            </div>
            <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" to={adminRoutes.orders.path}>
              همه سفارش‌ها <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {orders.isPending ? <QueueSkeleton /> : pendingOrders.length ? (
              <ul className="divide-y divide-border">
                {pendingOrders.slice(0, 5).map((order) => (
                  <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={order.id}>
                    <div>
                      <p className="font-medium" dir="ltr">#{order.orderNumber}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{order.grandTotal} {order.currency}</p>
                    </div>
                    <StatusBadge tone="warning">نیازمند بررسی</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : <QueueEmpty>در تازه‌ترین سفارش‌ها مورد بازی برای بررسی نیست.</QueueEmpty>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>آمادگی کاتالوگ</CardTitle>
              <CardDescription>پیش‌نویس‌هایی که می‌توانید اطلاعات و گونه‌هایشان را کامل کنید.</CardDescription>
            </div>
            <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" to={adminRoutes.catalog.path}>
              همه کالاها <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {products.isPending ? <QueueSkeleton /> : draftProducts.length ? (
              <ul className="divide-y divide-border">
                {draftProducts.slice(0, 5).map((product) => (
                  <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" key={product.id}>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.title}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground" dir="ltr">{product.slug}</p>
                    </div>
                    <Link
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                      search={{ product: product.id, tab: 'general' }}
                      to={adminRoutes.catalog.path}
                    >
                      تکمیل کالا
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <QueueEmpty>در تازه‌ترین کالاها پیش‌نویس بازی دیده نشد.</QueueEmpty>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({ description, icon: Icon, label, loading, tone, value }: { readonly description: string; readonly icon: typeof ShoppingBag; readonly label: string; readonly loading: boolean; readonly tone: 'neutral' | 'success' | 'warning'; readonly value: number }) {
  const iconTone = tone === 'success' ? 'bg-success/10 text-success' : tone === 'warning' ? 'bg-warning/10 text-warning-foreground' : 'bg-muted text-muted-foreground';
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-2 h-8 w-14" /> : <p className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString('fa-IR')}</p>}
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconTone}`}><Icon aria-hidden="true" className="size-5" /></span>
      </CardContent>
    </Card>
  );
}

function QueueSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton className="h-12" key={index} />)}</div>;
}

function QueueEmpty({ children }: { readonly children: string }) {
  return <p className="rounded-lg bg-muted/45 px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
