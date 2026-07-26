import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <section className="max-w-md text-center">
        <p className="text-sm font-medium text-muted-foreground" dir="ltr">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          صفحه پیدا نشد
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          مسیر درخواستی در پنل مدیریت وجود ندارد.
        </p>
        <Button asChild className="mt-7">
          <Link to="/">بازگشت به پنل مدیریت</Link>
        </Button>
      </section>
    </main>
  );
}
