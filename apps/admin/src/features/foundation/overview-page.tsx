import { Boxes, PackageSearch, ShoppingBag } from 'lucide-react';
import { FeedbackPanel, PageHeader } from '@/components/ui';

const plannedQueues = [
  {
    title: 'سفارش‌های نیازمند بررسی',
    description: 'سفارش‌هایی که برای پرداخت، تأیید یا ارسال منتظر اقدام هستند.',
    icon: ShoppingBag,
  },
  {
    title: 'وضعیت موجودی',
    description: 'کالاهای کم‌موجود یا بدون تنظیم موجودی در این بخش دیده می‌شوند.',
    icon: Boxes,
  },
  {
    title: 'آمادگی کالاها',
    description: 'پیش‌نویس‌های ناقص و کالاهای بدون قیمت از اینجا قابل پیگیری‌اند.',
    icon: PackageSearch,
  },
] as const;

export function OverviewPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-8" dir="rtl">
      <PageHeader
        description="کارهای مهم فروشگاه از اینجا پیگیری می‌شوند. هر عدد و فهرست پس از اتصال قرارداد معتبر همان بخش نمایش داده خواهد شد."
        eyebrow="فضای کاری فروشگاه"
        title="نمای کلی"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {plannedQueues.map(({ description, icon: Icon, title }) => (
          <article
            className="rounded-2xl border border-border bg-card p-5 shadow-xs"
            key={title}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </article>
        ))}
      </div>

      <FeedbackPanel title="داده عملیاتی در مرحله بعد متصل می‌شود">
        این نما عمداً عدد نمایشی یا ساختگی تولید نمی‌کند. صف‌های کاری پس از
        آماده‌شدن قراردادهای داشبورد به داده واقعی و قابل اقدام متصل می‌شوند.
      </FeedbackPanel>
    </section>
  );
}
