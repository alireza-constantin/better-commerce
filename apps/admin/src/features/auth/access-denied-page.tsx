import type { AdminProblem } from '@/api/problems';
import { LogoutButton } from './logout-button';

interface AccessDeniedPageProps {
  readonly problem: AdminProblem;
}

export function AccessDeniedPage({ problem }: AccessDeniedPageProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <section className="max-w-lg text-center">
        <p className="text-sm font-medium text-muted-foreground" dir="ltr">
          403
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          دسترسی مدیریتی لازم است
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          این حساب وارد شده است، اما دسترسی فعال برای استفاده از پنل مدیریت
          ندارد. از مالک فروشگاه یا مدیر بخواهید دسترسی شما را بررسی کند.
        </p>
        {'requestId' in problem && problem.requestId ? (
          <p className="mt-4 text-xs text-muted-foreground">
            شناسه درخواست: <bdi dir="ltr">{problem.requestId}</bdi>
          </p>
        ) : null}
        <div className="mt-7 flex justify-center">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
