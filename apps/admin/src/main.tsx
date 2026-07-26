import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from '@/app/query-client';
import { router } from '@/app/router';
import { subscribeToSessionLoss } from '@/api/client';
import { adminCsrfTokenManager } from '@/api/csrf';
import { adminSessionQueryKey } from '@/features/auth/api/auth-query';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Admin root element is missing.');
}

subscribeToSessionLoss(() => {
  adminCsrfTokenManager.invalidate();
  queryClient.getMutationCache().clear();
  queryClient.removeQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === 'admin' && queryKey[1] !== 'session',
  });
  void queryClient.resetQueries({
    queryKey: adminSessionQueryKey,
    exact: true,
  });
});

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
