import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { isAdminApiError } from '@/api/client';
import { normalizeProblem, type AdminProblem } from '@/api/problems';
import { Button } from '@/components/ui/button';
import { login } from './api/auth-api';
import { adminSessionQueryKey } from './api/auth-query';

export function LoginPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [problem, setProblem] = useState<AdminProblem>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setProblem(undefined);

    try {
      await login({ email, password });
      setPassword('');
      await queryClient.resetQueries({ queryKey: adminSessionQueryKey });
    } catch (error) {
      setProblem(
        isAdminApiError(error) ? error.problem : normalizeProblem(error),
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[minmax(22rem,0.8fr)_minmax(30rem,1.2fr)]">
      <section className="flex items-center border-b border-border px-6 py-12 lg:border-b-0 lg:border-e lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-medium text-muted-foreground">
            Better Commerce
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em]">
            ورود به مدیریت فروشگاه
          </h1>
          <p className="mt-4 leading-7 text-muted-foreground">
            با ایمیل و رمز عبور حساب کاربری مجاز خود وارد شوید.
          </p>

          <form
            className="mt-9 space-y-5"
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                ایمیل
              </label>
              <input
                autoComplete="email"
                autoFocus
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                disabled={isPending}
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                dir="ltr"
                type="email"
                value={email}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                رمز عبور
              </label>
              <input
                autoComplete="current-password"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                disabled={isPending}
                id="password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                dir="ltr"
                type="password"
                value={password}
              />
            </div>

            {problem ? (
              <div
                aria-live="polite"
                className="rounded-lg bg-destructive/8 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                <p className="font-medium">ورود انجام نشد</p>
                <p className="mt-1 leading-6">
                  {loginProblemMessage(problem)}
                </p>
                {'requestId' in problem && problem.requestId ? (
                  <p className="mt-2 text-xs opacity-80">
                    شناسه درخواست:{' '}
                    <bdi dir="ltr">{problem.requestId}</bdi>
                  </p>
                ) : null}
              </div>
            ) : null}

            <Button
              className="h-11 w-full"
              disabled={isPending}
              type="submit"
            >
              {isPending ? 'در حال ورود…' : 'ورود'}
            </Button>
          </form>
        </div>
      </section>

      <section className="hidden items-end bg-primary p-12 text-primary-foreground lg:flex">
        <p className="max-w-lg text-balance text-3xl font-medium leading-tight tracking-[-0.025em]">
          محصولات، موجودی، ارسال، سفارش‌ها و کارکنان را از یک فضای کاری
          مطمئن مدیریت کنید.
        </p>
      </section>
    </main>
  );
}

function loginProblemMessage(problem: AdminProblem): string {
  if (problem.kind === 'api' && problem.status === 401) {
    return 'ایمیل یا رمز عبور واردشده صحیح نیست.';
  }

  if (problem.kind === 'api' && problem.status === 429) {
    return 'تعداد تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.';
  }

  if (problem.kind === 'network') {
    return 'ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.';
  }

  return 'پاسخ معتبری از سرویس دریافت نشد. دوباره تلاش کنید.';
}
