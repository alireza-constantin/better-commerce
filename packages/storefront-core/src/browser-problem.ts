export interface StorefrontProblemFieldError {
  readonly detail: string;
  readonly field?: string;
}

export type StorefrontBrowserProblem =
  | {
      readonly kind: 'api';
      readonly status: number;
      readonly type: string;
      readonly title: string;
      readonly detail: string;
      readonly requestId?: string;
      readonly code?: string;
      readonly retryAfterSeconds?: number;
      readonly errors: readonly StorefrontProblemFieldError[];
    }
  | {
      readonly kind: 'network';
      readonly title: 'خطای شبکه';
      readonly detail: 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';
    }
  | {
      readonly kind: 'aborted';
      readonly title: 'درخواست لغو شد';
      readonly detail: 'درخواست پیش از تکمیل لغو شد.';
    }
  | {
      readonly kind: 'unexpected';
      readonly title: 'خطای غیرمنتظره';
      readonly detail: 'انجام درخواست ممکن نشد. دوباره تلاش کنید.';
      readonly requestId?: string;
    };

export class StorefrontBrowserError extends Error {
  constructor(
    readonly problem: StorefrontBrowserProblem,
    readonly userMessage: string = userMessageFor(problem),
  ) {
    super(userMessage);
    this.name = 'StorefrontBrowserError';
  }
}

export function isStorefrontBrowserError(
  value: unknown,
): value is StorefrontBrowserError {
  return value instanceof StorefrontBrowserError;
}

export function normalizeStorefrontProblem(
  input: unknown,
  response?: Response,
): StorefrontBrowserProblem {
  if (!response && isNamedError(input, 'AbortError')) {
    return {
      kind: 'aborted',
      title: 'درخواست لغو شد',
      detail: 'درخواست پیش از تکمیل لغو شد.',
    };
  }

  if (!response && input instanceof TypeError) {
    return {
      kind: 'network',
      title: 'خطای شبکه',
      detail: 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.',
    };
  }

  const body = isRecord(input) ? input : undefined;
  const status = response?.status ?? numberValue(body?.status);
  const requestId =
    response?.headers.get('x-request-id') ?? stringValue(body?.requestId);

  if (status !== undefined) {
    return {
      kind: 'api',
      status,
      type:
        stringValue(body?.type) ?? `urn:better-commerce:problem:http-${status}`,
      title: stringValue(body?.title) ?? `HTTP ${status}`,
      detail: stringValue(body?.detail) ?? 'The server rejected the request.',
      ...(requestId ? { requestId } : {}),
      ...(stringValue(body?.code) ? { code: stringValue(body?.code) } : {}),
      ...(positiveInteger(body?.retryAfterSeconds)
        ? { retryAfterSeconds: body.retryAfterSeconds }
        : {}),
      errors: fieldErrors(body?.errors),
    };
  }

  return {
    kind: 'unexpected',
    title: 'خطای غیرمنتظره',
    detail: 'انجام درخواست ممکن نشد. دوباره تلاش کنید.',
    ...(requestId ? { requestId } : {}),
  };
}

function userMessageFor(problem: StorefrontBrowserProblem): string {
  if (problem.kind !== 'api') return problem.detail;
  switch (problem.status) {
    case 400:
      return 'اطلاعات واردشده معتبر نیست.';
    case 401:
      return 'برای ادامه دوباره وارد حساب خود شوید.';
    case 403:
      return 'اجازه انجام این عملیات را ندارید.';
    case 404:
      return 'اطلاعات موردنظر پیدا نشد.';
    case 409:
      return 'اطلاعات تغییر کرده است. وضعیت را بررسی و دوباره تلاش کنید.';
    case 429:
      return 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.';
    default:
      return 'انجام درخواست ممکن نشد. دوباره تلاش کنید.';
  }
}

function fieldErrors(value: unknown): readonly StorefrontProblemFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StorefrontProblemFieldError[] => {
    if (!isRecord(item)) return [];
    const detail = stringValue(item.detail);
    if (!detail) return [];
    const field =
      stringValue(item.field) ??
      stringValue(item.path) ??
      stringValue(item.key);
    return [{ detail, ...(field ? { field } : {}) }];
  });
}

function isNamedError(value: unknown, name: string): boolean {
  return isRecord(value) && value.name === name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
