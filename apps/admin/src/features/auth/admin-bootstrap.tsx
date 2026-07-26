import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { isAdminApiError } from '@/api/client';
import { AccessDeniedPage } from './access-denied-page';
import { LoginPage } from './login-page';
import { SessionLoadingPage } from './session-loading-page';
import { SessionUnavailablePage } from './session-unavailable-page';
import { adminSessionQueryOptions } from './api/auth-query';

interface AdminBootstrapProps {
  readonly children: ReactNode;
}

export function AdminBootstrap({ children }: AdminBootstrapProps) {
  const session = useQuery(adminSessionQueryOptions());

  if (session.isPending) {
    return <SessionLoadingPage />;
  }

  if (session.isError) {
    const problem = isAdminApiError(session.error)
      ? session.error.problem
      : undefined;

    if (problem?.kind === 'api' && problem.status === 401) {
      return <LoginPage />;
    }

    if (problem?.kind === 'api' && problem.status === 403) {
      return <AccessDeniedPage problem={problem} />;
    }

    return (
      <SessionUnavailablePage
        onRetry={() => {
          void session.refetch();
        }}
        problem={problem}
      />
    );
  }

  return children;
}
