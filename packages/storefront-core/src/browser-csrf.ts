import {
  isStorefrontBrowserError,
  type StorefrontBrowserError,
} from './browser-problem.js';

const CSRF_INVALID_CODE = 'security.csrf_invalid';

export class StorefrontCsrfRetryLimitError extends Error {
  constructor() {
    super('A CSRF-protected request may only be retried once');
    this.name = 'StorefrontCsrfRetryLimitError';
  }
}

export class StorefrontCsrfTokenManager {
  private token: string | undefined;
  private acquisition: Promise<string> | undefined;
  private generation = 0;

  constructor(private readonly requestToken: () => Promise<string>) {}

  async getToken(): Promise<string> {
    if (this.token !== undefined) return this.token;
    const generation = this.generation;
    const acquisition = this.acquisition ?? this.acquire(generation);
    const token = await acquisition;
    return generation === this.generation ? token : this.getToken();
  }

  invalidate(): void {
    this.generation += 1;
    this.token = undefined;
    this.acquisition = undefined;
  }

  async retryOnce<T>(
    retryCount: number,
    retry: (token: string) => Promise<T>,
  ): Promise<T> {
    if (retryCount !== 0) throw new StorefrontCsrfRetryLimitError();
    this.invalidate();
    return retry(await this.getToken());
  }

  private acquire(generation: number): Promise<string> {
    const acquisition = this.requestToken()
      .then((token) => {
        if (!token) throw new Error('The CSRF endpoint returned an invalid token');
        if (generation === this.generation) this.token = token;
        return token;
      })
      .finally(() => {
        if (this.acquisition === acquisition) this.acquisition = undefined;
      });
    this.acquisition = acquisition;
    return acquisition;
  }
}

export async function executeStorefrontCsrfRequest<T>(
  manager: StorefrontCsrfTokenManager,
  request: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await request(await manager.getToken());
  } catch (error) {
    if (!isCsrfFailure(error)) throw error;
    return manager.retryOnce(0, request);
  }
}

function isCsrfFailure(error: unknown): error is StorefrontBrowserError {
  return (
    isStorefrontBrowserError(error) &&
    error.problem.kind === 'api' &&
    error.problem.status === 403 &&
    error.problem.code === CSRF_INVALID_CODE
  );
}
