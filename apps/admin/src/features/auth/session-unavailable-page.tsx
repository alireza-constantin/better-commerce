import type { AdminProblem } from '@/api/problems';
import { Button } from '@/components/ui/button';

interface SessionUnavailablePageProps {
  readonly onRetry: () => void;
  readonly problem?: AdminProblem;
}

export function SessionUnavailablePage({
  onRetry,
  problem,
}: SessionUnavailablePageProps) {
  const apiUnavailable =
    problem?.kind === 'network' ||
    (problem?.kind === 'api' &&
      (problem.code === 'admin.api_unavailable' ||
        [502, 503, 504].includes(problem.status)));

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <section className="max-w-lg text-center">
        <p className="text-sm font-medium text-muted-foreground">
          سرویس در دسترس نیست
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {apiUnavailable ? 'سرویس API در دسترس نیست' : 'نشست شما تأیید نشد'}
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          {apiUnavailable
            ? 'پنل مدیریت اجرا شده است، اما نمی‌تواند به API فروشگاه متصل شود. Docker و سرویس‌های محلی را اجرا کنید، سپس بعد از آماده‌شدن API دوباره تلاش کنید.'
            : 'پنل مدیریت پاسخ معتبری برای احراز هویت دریافت نکرد. وضعیت سرویس را بررسی و دوباره تلاش کنید؛ از حساب شما خارج نشده‌ایم.'}
        </p>
        {problem && 'requestId' in problem && problem.requestId ? (
          <p className="mt-4 text-xs text-muted-foreground">
            شناسه درخواست: <bdi dir="ltr">{problem.requestId}</bdi>
          </p>
        ) : null}
        <Button className="mt-7" onClick={onRetry}>
          تلاش دوباره
        </Button>
      </section>
    </main>
  );
}
