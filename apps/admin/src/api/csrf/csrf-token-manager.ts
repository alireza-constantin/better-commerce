/**
 * The only response shape the CSRF lifecycle needs from the API. Keeping this
 * independent of the generated SDK makes the manager usable by any adapter.
 */
export interface CsrfTokenResponse {
  readonly csrfToken: string;
}

/**
 * Inject the transport so this module remains browser-framework and SDK
 * agnostic. The eventual adapter is responsible for credentialed transport.
 */
export type RequestCsrfToken = () => Promise<CsrfTokenResponse>;

export type CsrfProtectedRetry<T> = (csrfToken: string) => Promise<T>;

/** Raised when a caller attempts more than one explicit CSRF retry. */
export class CsrfRetryLimitError extends Error {
  constructor() {
    super('A CSRF-protected request may only be retried once');
    this.name = 'CsrfRetryLimitError';
  }
}

function isCsrfToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Holds a session-bound CSRF token in memory only.
 *
 * `invalidate` must be called after successful login, logout, session loss,
 * or any other session rotation. This class never reads or writes browser
 * storage and never automatically replays a request.
 */
export class CsrfTokenManager {
  private token: string | undefined;
  private acquisition: Promise<string> | undefined;
  private generation = 0;

  constructor(private readonly requestToken: RequestCsrfToken) {}

  /** Returns the current token, coalescing simultaneous token acquisitions. */
  async getToken(): Promise<string> {
    if (this.token !== undefined) {
      return this.token;
    }

    const generation = this.generation;
    const acquisition = this.acquisition ?? this.acquire(generation);
    const token = await acquisition;

    // A login/logout/session rotation can finish while the request is in
    // flight. Do not hand its previous-session token to the caller.
    if (generation !== this.generation) {
      return this.getToken();
    }

    return token;
  }

  /**
   * Discards only in-memory protocol state. It deliberately cannot affect the
   * HttpOnly session cookie owned by the server.
   */
  invalidate(): void {
    this.generation += 1;
    this.token = undefined;
    this.acquisition = undefined;
  }

  /**
   * Reacquires a token and performs exactly one caller-authorized retry.
   *
   * Call this only after the adapter has positively identified a CSRF failure.
   * The manager does not observe responses and will never replay mutations by
   * itself. Pass `0` for a first retry; any other count is rejected, letting
   * the caller keep its per-request retry budget explicit.
   */
  async retryOnce<T>(
    retryCount: number,
    retry: CsrfProtectedRetry<T>,
  ): Promise<T> {
    if (retryCount !== 0) {
      throw new CsrfRetryLimitError();
    }

    this.invalidate();
    return retry(await this.getToken());
  }

  private acquire(generation: number): Promise<string> {
    const acquisition = this.requestToken()
      .then(({ csrfToken }) => {
        if (!isCsrfToken(csrfToken)) {
          throw new Error('The CSRF endpoint returned an invalid token');
        }

        if (generation === this.generation) {
          this.token = csrfToken;
        }

        return csrfToken;
      })
      .finally(() => {
        if (this.acquisition === acquisition) {
          this.acquisition = undefined;
        }
      });

    this.acquisition = acquisition;
    return acquisition;
  }
}
