import {
  adminApiClient,
  executeApiRequest,
  isAdminApiError,
} from '@/api/client';
import { CsrfTokenManager } from './csrf-token-manager';

const CSRF_INVALID_PROBLEM_CODE = 'security.csrf_invalid';

export const adminCsrfTokenManager = new CsrfTokenManager(async () =>
  executeApiRequest(() => adminApiClient.GET('/api/v1/auth/csrf')),
);

/**
 * Replays only a request the API positively rejected in CSRF middleware before
 * controller execution. Other 403 responses are authorization decisions and
 * are never replayed.
 */
export async function executeWithCsrf<T>(
  request: (csrfToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await request(await adminCsrfTokenManager.getToken());
  } catch (error) {
    if (
      !isAdminApiError(error) ||
      error.problem.kind !== 'api' ||
      error.problem.status !== 403 ||
      error.problem.code !== CSRF_INVALID_PROBLEM_CODE
    ) {
      throw error;
    }

    return adminCsrfTokenManager.retryOnce(0, request);
  }
}
