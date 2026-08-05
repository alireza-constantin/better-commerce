import { normalizeProblem, type AdminProblem } from '@/api/problems';
import { publishSessionLoss } from './session-lifecycle';

interface ApiResponse<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

interface ExecuteRequestOptions {
  readonly publishUnauthorized?: boolean;
}

export class AdminApiError extends Error {
  readonly problem: AdminProblem;

  constructor(problem: AdminProblem) {
    super(problem.title);
    this.name = 'AdminApiError';
    this.problem = problem;
  }
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  if (error instanceof AdminApiError) return true;

  // `instanceof` is normally enough, but development module reloads can leave
  // React Query holding an error created by a previous module instance. Keep
  // the UI's error boundary stable by recognizing our deliberately small,
  // serializable error contract as well.
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AdminApiError' &&
    'problem' in error &&
    isAdminProblem(error.problem)
  );
}

export async function executeApiRequest<T>(
  request: () => Promise<ApiResponse<T>>,
  options?: ExecuteRequestOptions,
): Promise<T> {
  const result = await performRequest(request, options);

  if (result.data === undefined) {
    throw new AdminApiError(
      normalizeProblem(undefined, {
        requestId: result.response.headers.get('x-request-id') ?? undefined,
      }),
    );
  }

  return result.data;
}

export async function executeEmptyApiRequest(
  request: () => Promise<ApiResponse<unknown>>,
  options?: ExecuteRequestOptions,
): Promise<void> {
  await performRequest(request, options);
}

async function performRequest<T>(
  request: () => Promise<ApiResponse<T>>,
  options: ExecuteRequestOptions = {},
): Promise<ApiResponse<T>> {
  let result: ApiResponse<T>;

  try {
    result = await request();
  } catch (error) {
    throw new AdminApiError(normalizeProblem(error));
  }

  if (result.error !== undefined || !result.response.ok) {
    const problem = normalizeProblem(result.error, {
      response: result.response,
    });

    if (
      problem.kind === 'api' &&
      problem.status === 401 &&
      options.publishUnauthorized !== false
    ) {
      publishSessionLoss('unauthorized');
    }

    throw new AdminApiError(problem);
  }

  return result;
}

function isAdminProblem(value: unknown): value is AdminProblem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof value.kind === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'detail' in value &&
    typeof value.detail === 'string'
  );
}
