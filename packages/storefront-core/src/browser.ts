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
  BetterCommerceApiSchemas['SubmitCartOrderDto'] & {
    readonly promotionCode?: string | null;
  };
export type StorefrontOrder = BetterCommerceApiSchemas['OrderResponseDto'] & {
  readonly discountTotal: string;
};
export type StorefrontOrdersPage = Omit<
  BetterCommerceApiSchemas['OrdersPageResponseDto'],
  'items'
> & { readonly items: readonly StorefrontOrder[] };
export type StorefrontCart = BetterCommerceApiSchemas['CartResponseDto'];
export type StorefrontCartDeliveryAddress =
  BetterCommerceApiSchemas['CartDeliveryAddressDto'];
export interface StorefrontPromotionQuote {
  readonly status: 'applied' | 'not_applied';
  readonly promotionId: string | null;
  readonly definitionVersion: string | null;
  readonly name: string | null;
  readonly code: string | null;
  readonly discount: { readonly amount: string; readonly currency: string };
  readonly allocations: readonly {
    readonly variantId: string;
    readonly amount: { readonly amount: string; readonly currency: string };
  }[];
  readonly reason: string | null;
}
export type StorefrontCheckoutPreparation =
  BetterCommerceApiSchemas['CartCheckoutPreparationResponseDto'] & {
    readonly promotion: StorefrontPromotionQuote;
  };

export type StorefrontSessionSnapshot =
  | { readonly status: 'unknown'; readonly customer: null }
  | { readonly status: 'anonymous'; readonly customer: null }
  | { readonly status: 'authenticated'; readonly customer: StorefrontCustomer };

export type StorefrontSessionListener = (
  snapshot: StorefrontSessionSnapshot,
) => void;
export type StorefrontCartListener = (cart: StorefrontCart) => void;

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
  const cartListeners = new Set<StorefrontCartListener>();
  let sessionSnapshot: StorefrontSessionSnapshot = {
    status: 'unknown',
    customer: null,
  };
  let sessionEpoch = 0;
  let cartSnapshot: StorefrontCart = emptyCart();

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

  const publishCart = (cart: StorefrontCart) => {
    cartSnapshot = cart;
    for (const listener of cartListeners) {
      try {
        listener(cart);
      } catch {
        // UI subscribers cannot interrupt the Cart protocol.
      }
    }
  };

  const getCurrentCart = async (signal?: AbortSignal) => {
    const cart = await execute(() => client.GET('/api/v1/cart', { signal }), {
      publishUnauthorized: false,
    });
    publishCart(cart);
    return cart;
  };

  const refreshAfterVersionConflict = async (error: unknown): Promise<never> => {
    if (
      isStorefrontBrowserError(error) &&
      error.problem.kind === 'api' &&
      error.problem.code === 'cart.version_conflict'
    ) {
      await getCurrentCart();
    }
    throw error;
  };

  const claimAnonymousCart = async (
    expectedVersion: number,
  ): Promise<StorefrontCart> => {
    try {
      const cart = await withCsrf((token) =>
        execute(() =>
          client.POST('/api/v1/cart/claim', {
            body: { expectedVersion },
            params: { header: { 'x-csrf-token': token } },
          }),
        ),
      );
      publishCart(cart);
      return cart;
    } catch (error) {
      return refreshAfterVersionConflict(error);
    }
  };

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
            client.POST('/api/v1/checkout/cart-orders', {
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
            const typedOrder = order as StorefrontOrder;
            completed = typedOrder;
            publishCart(emptyCart());
            return typedOrder;
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
        const anonymousCart = await getCurrentCart();
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
        if (anonymousCart.id) {
          await claimAnonymousCart(anonymousCart.version);
        } else {
          await getCurrentCart();
        }
        return customer;
      },
      async register(
        input: StorefrontRegistrationInput,
      ): Promise<StorefrontCustomer> {
        const anonymousCart = await getCurrentCart();
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
        if (anonymousCart.id && sessionSnapshot.status === 'authenticated') {
          await claimAnonymousCart(anonymousCart.version);
        } else {
          await getCurrentCart();
        }
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
    cart: {
      getSnapshot: () => cartSnapshot,
      subscribe(listener: StorefrontCartListener) {
        cartListeners.add(listener);
        return () => {
          cartListeners.delete(listener);
        };
      },
      getCurrent: getCurrentCart,
      async prepareCheckout(
        deliveryAddress: StorefrontCartDeliveryAddress,
        options:
          | AbortSignal
          | {
              readonly signal?: AbortSignal;
              readonly promotionCode?: string | null;
            } = {},
      ): Promise<StorefrontCheckoutPreparation> {
        const requestOptions: {
          readonly signal?: AbortSignal;
          readonly promotionCode?: string | null;
        } =
          typeof AbortSignal !== 'undefined' && options instanceof AbortSignal
            ? { signal: options }
            : (options as {
                readonly signal?: AbortSignal;
                readonly promotionCode?: string | null;
              });
        try {
          return (await withCsrf((token) =>
            execute(() =>
              client.POST('/api/v1/cart/checkout-preparation', {
                body: {
                  expectedVersion: cartSnapshot.version,
                  deliveryAddress,
                  promotionCode: requestOptions.promotionCode ?? null,
                },
                params: { header: { 'x-csrf-token': token } },
                signal: requestOptions.signal,
              }),
            ),
          )) as StorefrontCheckoutPreparation;
        } catch (error) {
          return refreshAfterVersionConflict(error);
        }
      },
      async setQuantity(
        variantId: string,
        quantity: number,
      ): Promise<StorefrontCart> {
        try {
          const cart = await withCsrf((token) =>
            execute(() =>
              client.PUT('/api/v1/cart/lines', {
                body: {
                  expectedVersion: cartSnapshot.version,
                  variantId,
                  quantity,
                },
                params: { header: { 'x-csrf-token': token } },
              }),
            ),
          );
          publishCart(cart);
          return cart;
        } catch (error) {
          return refreshAfterVersionConflict(error);
        }
      },
      async remove(lineId: string): Promise<StorefrontCart> {
        try {
          const cart = await withCsrf((token) =>
            execute(() =>
              client.POST('/api/v1/cart/lines/{lineId}/remove', {
                body: { expectedVersion: cartSnapshot.version },
                params: {
                  path: { lineId },
                  header: { 'x-csrf-token': token },
                },
              }),
            ),
          );
          publishCart(cart);
          return cart;
        } catch (error) {
          return refreshAfterVersionConflict(error);
        }
      },
      async clear(): Promise<StorefrontCart> {
        try {
          const cart = await withCsrf((token) =>
            execute(() =>
              client.POST('/api/v1/cart/clear', {
                body: { expectedVersion: cartSnapshot.version },
                params: { header: { 'x-csrf-token': token } },
              }),
            ),
          );
          publishCart(cart);
          return cart;
        } catch (error) {
          return refreshAfterVersionConflict(error);
        }
      },
      claim: claimAnonymousCart,
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
        ).then((page) => page as StorefrontOrdersPage);
      },
      get(orderId: string, signal?: AbortSignal): Promise<StorefrontOrder> {
        return execute(() =>
          client.GET('/api/v1/orders/{orderId}', {
            params: { path: { orderId } },
            signal,
          }),
        ).then((order) => order as StorefrontOrder);
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

function emptyCart(): StorefrontCart {
  return {
    id: null,
    version: 0,
    status: 'active',
    expiresAt: null,
    lines: [],
  };
}
