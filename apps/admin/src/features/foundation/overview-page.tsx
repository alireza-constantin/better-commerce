export function OverviewPage() {
  return (
    <section className="mx-auto max-w-5xl">
      <div className="border-b border-border pb-6">
        <p className="text-sm font-medium text-muted-foreground">
          فضای کاری فروشگاه
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          نمای کلی
        </h1>
        <p className="mt-3 max-w-[70ch] leading-7 text-muted-foreground">
          برای مدیریت سفارش‌ها، محصولات، موجودی و تنظیمات فروشگاه از منوی
          مدیریت استفاده کنید.
        </p>
      </div>

      <div className="py-10">
        <h2 className="text-base font-semibold">عملیات فروشگاه</h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-7 text-muted-foreground">
          اطلاعات عملیاتی هر بخش پس از اتصال صفحه‌های همان قابلیت نمایش داده
          می‌شود. این صفحه آمار یا عددی را بدون داده معتبر API تولید نمی‌کند.
        </p>
      </div>
    </section>
  );
}
