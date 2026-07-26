/** A deliberately small, UI-safe representation of an API or transport error. */
export type AdminProblem =
  | ApiProblem
  | NetworkProblem
  | AbortedProblem
  | UnexpectedProblem;

export interface ProblemFieldError {
  readonly detail: string;
  /** The server may identify a field by `field`, `path`, or `key`. */
  readonly field?: string;
}

interface ApiProblem {
  readonly kind: 'api';
  readonly type: string;
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly instance?: string;
  readonly requestId?: string;
  readonly errors: readonly ProblemFieldError[];
  readonly code?: string;
  readonly retryAfterSeconds?: number;
}

interface NetworkProblem {
  readonly kind: 'network';
  readonly title: 'Network error';
  readonly detail: 'We could not reach the server. Check your connection and try again.';
}

interface AbortedProblem {
  readonly kind: 'aborted';
  readonly title: 'Request cancelled';
  readonly detail: 'The request was cancelled.';
}

interface UnexpectedProblem {
  readonly kind: 'unexpected';
  readonly title: 'Unexpected error';
  readonly detail: 'Something went wrong. Please try again.';
  readonly requestId?: string;
}

export type ProblemHeaders = Headers | Record<string, unknown>;

export interface ProblemNormalizationOptions {
  /** Use this when the response object is separate from its decoded body. */
  readonly response?: unknown;
  /** A caller-supplied correlation ID takes precedence over payload metadata. */
  readonly requestId?: string;
}

type UnknownRecord = Record<string, unknown>;

const TITLE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const NETWORK_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'ERR_NETWORK',
  'ETIMEDOUT',
]);

/**
 * Extracts the correlation ID emitted by the API without assuming a specific
 * response implementation. Header names are case-insensitive.
 */
export function extractRequestId(headers: unknown): string | undefined {
  if (!headers) return undefined;

  if (isRecord(headers) && typeof headers.get === 'function') {
    const get = headers.get as (name: string) => unknown;
    const value = safeHeaderGet(get, headers, 'x-request-id');
    return nonEmptyString(value);
  }

  if (!isRecord(headers)) return undefined;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== 'x-request-id') continue;
    return headerValue(value);
  }
  return undefined;
}

/**
 * Converts unknown fetch/SDK failures into a stable shape that is safe to put
 * in UI state. It intentionally never copies `Error.message`, stack traces,
 * or arbitrary response fields into the result.
 */
export function normalizeProblem(
  input: unknown,
  options: ProblemNormalizationOptions = {},
): AdminProblem {
  const response = options.response ?? responseFrom(input);

  if (response === undefined && isAbort(input)) {
    return {
      kind: 'aborted',
      title: 'Request cancelled',
      detail: 'The request was cancelled.',
    };
  }

  const requestId =
    nonEmptyString(options.requestId) ??
    extractRequestId(headersFrom(response)) ??
    requestIdFromBody(problemBody(input));

  const body = problemBody(input);
  const status = statusFrom(response) ?? statusFrom(input) ?? statusFrom(body);
  if (body && isProblemDetails(body, status)) {
    const problemStatus = validStatus(body.status) ? body.status : status;
    if (problemStatus !== undefined) {
      return toApiProblem(body, problemStatus, requestId);
    }
  }

  if (isNetworkError(input, response)) {
    return {
      kind: 'network',
      title: 'Network error',
      detail: 'We could not reach the server. Check your connection and try again.',
    };
  }

  if (status !== undefined) {
    return genericHttpProblem(status, requestId);
  }

  return {
    kind: 'unexpected',
    title: 'Unexpected error',
    detail: 'Something went wrong. Please try again.',
    ...(requestId ? { requestId } : {}),
  };
}

function toApiProblem(
  body: UnknownRecord,
  status: number,
  requestId: string | undefined,
): ApiProblem {
  const instance = nonEmptyString(body.instance);
  const code = nonEmptyString(body.code);
  const retryAfterSeconds = positiveInteger(body.retryAfterSeconds)
    ? body.retryAfterSeconds
    : undefined;
  return {
    kind: 'api',
    type: nonEmptyString(body.type) ?? `urn:better-commerce:problem:http-${status}`,
    status,
    title: nonEmptyString(body.title) ?? titleFor(status),
    detail: nonEmptyString(body.detail) ?? 'The server could not complete the request.',
    ...(instance ? { instance } : {}),
    ...(requestId ? { requestId } : {}),
    errors: fieldErrors(body.errors),
    ...(code ? { code } : {}),
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

function genericHttpProblem(status: number, requestId: string | undefined): ApiProblem {
  return {
    kind: 'api',
    type: `urn:better-commerce:problem:http-${status}`,
    status,
    title: titleFor(status),
    detail: 'The server could not complete the request.',
    ...(requestId ? { requestId } : {}),
    errors: [],
  };
}

function problemBody(input: unknown): UnknownRecord | undefined {
  if (!isRecord(input)) return undefined;
  if (isRecord(input.error)) return input.error;
  if (isRecord(input.body)) return input.body;
  if (isRecord(input.data)) return input.data;
  return input;
}

function responseFrom(input: unknown): unknown {
  return isRecord(input) ? input.response : undefined;
}

function headersFrom(value: unknown): unknown {
  return isRecord(value) ? value.headers : undefined;
}

function statusFrom(value: unknown): number | undefined {
  return isRecord(value) && validStatus(value.status) ? value.status : undefined;
}

function isProblemDetails(value: UnknownRecord, status: number | undefined): boolean {
  return (
    status !== undefined ||
    validStatus(value.status) ||
    typeof value.type === 'string' ||
    typeof value.title === 'string' ||
    typeof value.detail === 'string'
  );
}

function isNetworkError(input: unknown, response: unknown): boolean {
  if (response !== undefined || !isRecord(input)) return false;
  if (nonEmptyString(input.name) === 'NetworkError') return true;
  const code = nonEmptyString(input.code);
  if (code && NETWORK_ERROR_CODES.has(code)) return true;
  return input instanceof TypeError && isFetchNetworkMessage(nonEmptyString(input.message));
}

function isFetchNetworkMessage(message: string | undefined): boolean {
  return (
    message === 'Failed to fetch' ||
    message === 'Load failed' ||
    message === 'NetworkError when attempting to fetch resource.'
  );
}

function isAbort(input: unknown): boolean {
  return isRecord(input) && nonEmptyString(input.name) === 'AbortError';
}

function fieldErrors(value: unknown): readonly ProblemFieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ProblemFieldError[] => {
    if (!isRecord(entry)) return [];
    const detail = nonEmptyString(entry.detail);
    if (!detail) return [];
    const field =
      nonEmptyString(entry.field) ?? nonEmptyString(entry.path) ?? nonEmptyString(entry.key);
    return [{ detail, ...(field ? { field } : {}) }];
  });
}

function requestIdFromBody(body: UnknownRecord | undefined): string | undefined {
  return body ? nonEmptyString(body.requestId) : undefined;
}

function titleFor(status: number): string {
  return TITLE_BY_STATUS[status] ?? 'HTTP Error';
}

function validStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function headerValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return nonEmptyString(value[0]);
  return nonEmptyString(value);
}

function safeHeaderGet(
  get: (name: string) => unknown,
  receiver: UnknownRecord,
  name: string,
): unknown {
  try {
    return Reflect.apply(get, receiver, [name]);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}
