import type { AdminProblem } from '@/api/problems';
import { LogoutButton } from './logout-button';

interface AccessDeniedPageProps {
  readonly problem: AdminProblem;
}

export function AccessDeniedPage({ problem }: AccessDeniedPageProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <section className="max-w-lg text-center">
        <p className="text-sm font-medium text-muted-foreground">403</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Administrative access required
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          This account is signed in but does not have active permission to use
          Admin. Ask the store owner or an administrator to review your access.
        </p>
        {'requestId' in problem && problem.requestId ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Request ID: {problem.requestId}
          </p>
        ) : null}
        <div className="mt-7 flex justify-center">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
