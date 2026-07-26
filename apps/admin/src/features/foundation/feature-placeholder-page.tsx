interface FeaturePlaceholderPageProps {
  readonly description: string;
  readonly title: string;
}

export function FeaturePlaceholderPage({
  description,
  title,
}: FeaturePlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-5xl">
      <div className="border-b border-border pb-6">
        <p className="text-sm font-medium text-muted-foreground">
          مدیریت فروشگاه
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-[70ch] leading-7 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="py-10">
        <p className="text-sm leading-7 text-muted-foreground">
          پوسته و کنترل دسترسی این بخش آماده است. جریان عملیاتی آن در مرحله
          پیاده‌سازی قابلیت مربوط اضافه می‌شود.
        </p>
      </div>
    </section>
  );
}
