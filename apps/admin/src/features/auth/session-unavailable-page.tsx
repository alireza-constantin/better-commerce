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
          Service unavailable
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          We could not verify your session
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Admin did not receive a reliable authentication response. Check the
          service and try again; you have not been signed out.
        </p>
        {problem && 'requestId' in problem && problem.requestId ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Request ID: {problem.requestId}
          </p>
        ) : null}
        <Button className="mt-7" onClick={onRetry}>
          Try again
        </Button>
      </section>
    </main>
  );
}
