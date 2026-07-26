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
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <section className="max-w-lg text-center">
        <p className="text-sm font-medium text-muted-foreground">
          سرویس در دسترس نیست
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          نشست شما تأیید نشد
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          پنل مدیریت پاسخ معتبری برای احراز هویت دریافت نکرد. وضعیت سرویس را
          بررسی و دوباره تلاش کنید؛ از حساب شما خارج نشده‌ایم.
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
