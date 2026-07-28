import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import {
  createBrowserBetterCommerceClient,
  type BetterCommerceBrowserClientOptions,
} from '@better-commerce/sdk/browser';
import {
  StorefrontBrowserError,
  isStorefrontBrowserError,
  normalizeStorefrontProblem,
} from './browser-problem.js';
import {
  executeStorefrontCsrfRequest,
  StorefrontCsrfRetryLimitError,
  StorefrontCsrfTokenManager,
} from './browser-csrf.js';

export {
  StorefrontBrowserError,
  isStorefrontBrowserError,
  normalizeStorefrontProblem,
  StorefrontCsrfRetryLimitError,
  StorefrontCsrfTokenManager,
};
export type {
  StorefrontBrowserProblem,
  StorefrontProblemFieldError,
} from './browser-problem.js';

export type StorefrontCustomer =
  BetterCommerceApiSchemas['SafeUserResponseDto'];
export type StorefrontLoginInput = BetterCommerceApiSchemas['LoginDto'];
export type StorefrontRegistrationInput = BetterCommerceApiSchemas['RegisterDto'];
export type StorefrontPasswordChangeInput =
  BetterCommerceApiSchemas['ChangePasswordDto'];
export type StorefrontCheckoutInput =
  BetterCommerceApiSchemas['SubmitOrderDto'];
export type StorefrontOrder = BetterCommerceApiSchemas['OrderResponseDto'];
export type StorefrontOrdersPage =
  BetterCommerceApiSchemas['OrdersPageResponseDto'];

export type StorefrontSessionSnapshot =
  | { readonly status: 'unknown'; readonly customer: null }
  | { readonly status: 'anonymous'; readonly customer: null }
  | { readonly status: 'authenticated'; readonly customer: StorefrontCustomer };

export type StorefrontSessionListener = (
  snapshot: StorefrontSessionSnapshot,
) => void;

export interface StorefrontBrowserOptions
  extends BetterCommerceBrowserClientOptions {
  /** Injectable for deterministic tests; production defaults to crypto.randomUUID. */
  readonly generateIdempotencyKey?: () => string;
}

export interface StorefrontCheckoutSubmission {
  readonly idempotencyKey: string;
  submit(options?: { readonly signal?: AbortSignal }): Promise<StorefrontOrder>;
}

export class StorefrontCheckoutSessionChangedError extends Error {
  constructor() {
    super('نشست کاربر تغییر کرده است. فرایند پرداخت را دوباره آغاز کنید.');
    this.name = 'StorefrontCheckoutSessionChangedError';
  }
}

interface ApiResponse<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

export function createStorefrontBrowser(options: StorefrontBrowserOptions = {}) {
  const { generateIdempotencyKey = defaultIdempotencyKey, ...clientOptions } =
    options;
  const client = createBrowserBetterCommerceClient(clientOptions);
  const listeners = new Set<StorefrontSessionListener>();
  let sessionSnapshot: StorefrontSessionSnapshot = {
    status: 'unknown',
    customer: null,
  };
  let sessionEpoch = 0;

  const publishSession = (snapshot: StorefrontSessionSnapshot) => {
    if (sessionIdentity(sessionSnapshot) !== sessionIdentity(snapshot)) {
      sessionEpoch += 1;
    }
    sessionSnapshot = snapshot;
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        // A UI subscriber cannot interrupt security-protocol state changes.
      }
    }
  };

  const execute = async <T>(
    request: () => Promise<ApiResponse<T>>,
    requestOptions: { publishUnauthorized?: boolean } = {},
  ): Promise<T> => {
    let result: ApiResponse<T>;
    try {
      result = await request();
    } catch (error) {
      throw new StorefrontBrowserError(normalizeStorefrontProblem(error));
    }
    if (result.error !== undefined || !result.response.ok) {
      const error = new StorefrontBrowserError(
        normalizeStorefrontProblem(result.error, result.response),
      );
      if (
        error.problem.kind === 'api' &&
        error.problem.status === 401 &&
        requestOptions.publishUnauthorized !== false
      ) {
        csrf.invalidate();
        publishSession({ status: 'anonymous', customer: null });
      }
      throw error;
    }
    if (result.data === undefined) {
      throw new StorefrontBrowserError(normalizeStorefrontProblem(undefined));
    }
    return result.data;
  };

  const executeEmpty = async (
    request: () => Promise<ApiResponse<unknown>>,
    requestOptions?: { publishUnauthorized?: boolean },
  ): Promise<void> => {
    let result: ApiResponse<unknown>;
    try {
      result = await request();
    } catch (error) {
      throw new StorefrontBrowserError(normalizeStorefrontProblem(error));
    }
    if (result.error !== undefined || !result.response.ok) {
      const error = new StorefrontBrowserError(
        normalizeStorefrontProblem(result.error, result.response),
      );
      if (
        error.problem.kind === 'api' &&
        error.problem.status === 401 &&
        requestOptions?.publishUnauthorized !== false
      ) {
        csrf.invalidate();
        publishSession({ status: 'anonymous', customer: null });
      }
      throw error;
    }
  };

  const csrf = new StorefrontCsrfTokenManager(async () => {
    const response = await execute(
      () => client.GET('/api/v1/auth/csrf'),
      { publishUnauthorized: false },
    );
    return response.csrfToken;
  });

  const withCsrf = <T>(request: (token: string) => Promise<T>) =>
    executeStorefrontCsrfRequest(csrf, request);

  const getCurrentCustomer = async (
    signal?: AbortSignal,
  ): Promise<StorefrontCustomer | null> => {
    try {
      const customer = await execute(
        () => client.GET('/api/v1/auth/me', { signal }),
        { publishUnauthorized: false },
      );
      publishSession({ status: 'authenticated', customer });
      return customer;
    } catch (error) {
      if (isUnauthorized(error)) {
        csrf.invalidate();
        publishSession({ status: 'anonymous', customer: null });
        return null;
      }
      throw error;
    }
  };

  const endSession = async (path: 'logout' | 'logout-all') => {
    try {
      await withCsrf((token) =>
        executeEmpty(() =>
          client.POST(`/api/v1/auth/${path}`, {
            params: { header: { 'x-csrf-token': token } },
          }),
        ),
      );
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
    } finally {
      csrf.invalidate();
    }
    publishSession({ status: 'anonymous', customer: null });
  };

  const createSubmission = (
    input: StorefrontCheckoutInput,
    submissionOptions: { readonly idempotencyKey?: string } = {},
  ): StorefrontCheckoutSubmission => {
    const idempotencyKey = validateIdempotencyKey(
      submissionOptions.idempotencyKey ?? generateIdempotencyKey(),
    );
    const serializedInput = serializeCheckoutInput(input);
    const submissionSessionEpoch = sessionEpoch;
    let inFlight: Promise<StorefrontOrder> | undefined;
    let completed: StorefrontOrder | undefined;

    return {
      idempotencyKey,
      submit(requestOptions = {}) {
        if (sessionEpoch !== submissionSessionEpoch) {
          throw new StorefrontCheckoutSessionChangedError();
        }
        if (completed) return Promise.resolve(completed);
        if (inFlight) return inFlight;
        const body = JSON.parse(serializedInput) as StorefrontCheckoutInput;
        const request = withCsrf((token) =>
          execute(() =>
            client.POST('/api/v1/checkout/orders', {
              body,
              params: {
                header: {
                  'Idempotency-Key': idempotencyKey,
                  'x-csrf-token': token,
                },
              },
              signal: requestOptions.signal,
            }),
          ),
        )
          .then((order) => {
            completed = order;
            return order;
          })
          .finally(() => {
            inFlight = undefined;
          });
        inFlight = request;
        return request;
      },
    };
  };

  return {
    session: {
      getSnapshot: () => sessionSnapshot,
      subscribe(listener: StorefrontSessionListener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getCurrentCustomer,
      async login(input: StorefrontLoginInput): Promise<StorefrontCustomer> {
        const customer = await withCsrf((token) =>
          execute(
            () =>
              client.POST('/api/v1/auth/login', {
                body: input,
                params: { header: { 'x-csrf-token': token } },
              }),
            { publishUnauthorized: false },
          ),
        );
        csrf.invalidate();
        publishSession({ status: 'authenticated', customer });
        return customer;
      },
      async register(
        input: StorefrontRegistrationInput,
      ): Promise<StorefrontCustomer> {
        const customer = await withCsrf((token) =>
          execute(
            () =>
              client.POST('/api/v1/auth/register', {
                body: input,
                params: { header: { 'x-csrf-token': token } },
              }),
            { publishUnauthorized: false },
          ),
        );
        csrf.invalidate();
        await getCurrentCustomer();
        return customer;
      },
      logout: () => endSession('logout'),
      logoutAll: () => endSession('logout-all'),
      async changePassword(input: StorefrontPasswordChangeInput): Promise<void> {
        await withCsrf((token) =>
          executeEmpty(() =>
            client.POST('/api/v1/auth/password/change', {
              body: input,
              params: { header: { 'x-csrf-token': token } },
            }),
          ),
        );
        csrf.invalidate();
      },
    },
    orders: {
      list(
        query: { readonly cursor?: string; readonly limit?: number } = {},
        signal?: AbortSignal,
      ): Promise<StorefrontOrdersPage> {
        return execute(() =>
          client.GET('/api/v1/orders', {
            params: { query },
            signal,
          }),
        );
      },
      get(orderId: string, signal?: AbortSignal): Promise<StorefrontOrder> {
        return execute(() =>
          client.GET('/api/v1/orders/{orderId}', {
            params: { path: { orderId } },
            signal,
          }),
        );
      },
    },
    checkout: { createSubmission },
  };
}

export type StorefrontBrowser = ReturnType<typeof createStorefrontBrowser>;

function isUnauthorized(error: unknown): boolean {
  return (
    isStorefrontBrowserError(error) &&
    error.problem.kind === 'api' &&
    error.problem.status === 401
  );
}

function sessionIdentity(snapshot: StorefrontSessionSnapshot): string {
  return snapshot.status === 'authenticated'
    ? `authenticated:${snapshot.customer.id}`
    : snapshot.status;
}

function defaultIdempotencyKey(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('A secure browser UUID generator is required for checkout');
  }
  return `checkout-${globalThis.crypto.randomUUID()}`;
}

function validateIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) {
    throw new TypeError('Checkout idempotency key must contain 1 to 120 characters');
  }
  return normalized;
}

function serializeCheckoutInput(input: StorefrontCheckoutInput): string {
  const serialized = JSON.stringify(input);
  if (!serialized) throw new TypeError('Checkout input must be JSON serializable');
  return serialized;
}
