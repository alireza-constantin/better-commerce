import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import {
  adminApiClient,
  executeApiRequest,
  executeEmptyApiRequest,
  publishSessionLoss,
} from '@/api/client';
import { adminCsrfTokenManager, executeWithCsrf } from '@/api/csrf';

export type AdminProfile =
  BetterCommerceApiSchemas['StaffProfileResponseDto'];
export type LoginCredentials = BetterCommerceApiSchemas['LoginDto'];

export async function getAdminProfile(
  signal?: AbortSignal,
): Promise<AdminProfile> {
  return executeApiRequest(
    () => adminApiClient.GET('/api/v1/admin/me', { signal }),
    {
      publishUnauthorized: false,
    },
  );
}

export async function login(credentials: LoginCredentials): Promise<void> {
  await executeWithCsrf((csrfToken) =>
    executeApiRequest(
      () =>
        adminApiClient.POST('/api/v1/auth/login', {
          body: credentials,
          params: {
            header: {
              'x-csrf-token': csrfToken,
            },
          },
        }),
      {
        publishUnauthorized: false,
      },
    ),
  );

  // Login regenerates the server session. The anonymous-session token cannot
  // be used for the new authenticated session.
  adminCsrfTokenManager.invalidate();
}

export async function logout(): Promise<void> {
  let completed = false;

  try {
    await executeWithCsrf((csrfToken) =>
      executeEmptyApiRequest(() =>
        adminApiClient.POST('/api/v1/auth/logout', {
          params: {
            header: {
              'x-csrf-token': csrfToken,
            },
          },
        }),
      ),
    );
    completed = true;
  } finally {
    adminCsrfTokenManager.invalidate();
  }

  if (completed) {
    publishSessionLoss('logout');
  }
}
