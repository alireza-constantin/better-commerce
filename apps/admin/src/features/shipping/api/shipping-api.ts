import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import {
  adminApiClient,
  executeApiRequest,
  executeEmptyApiRequest,
} from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type ShippingConfiguration =
  BetterCommerceApiSchemas['ShippingConfigurationResponseDto'];
export type ShippingZone = BetterCommerceApiSchemas['ShippingZoneResponseDto'];
export type ShippingMethod =
  BetterCommerceApiSchemas['ShippingMethodResponseDto'];
export type ShippingRule =
  BetterCommerceApiSchemas['ShippingRateRuleResponseDto'];
export type CreateZoneInput = BetterCommerceApiSchemas['CreateZoneDto'];
export type UpdateZoneInput = BetterCommerceApiSchemas['UpdateZoneDto'];
export type CreateMethodInput = BetterCommerceApiSchemas['CreateMethodDto'];
export type UpdateMethodInput = BetterCommerceApiSchemas['UpdateMethodDto'];
export type RateRuleInput = BetterCommerceApiSchemas['RateRuleDto'];

export async function getShippingConfiguration(
  signal?: AbortSignal,
): Promise<ShippingConfiguration> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/shipping', { signal }),
  );
}

export async function createShippingZone(input: CreateZoneInput) {
  return executeShippingRequest((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/shipping/zones', {
      body: input,
      params: { header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function updateShippingZone(input: {
  readonly id: string;
  readonly data: UpdateZoneInput;
}) {
  return executeShippingRequest((csrfToken) =>
    adminApiClient.PATCH('/api/v1/admin/shipping/zones/{id}', {
      body: input.data,
      params: { path: { id: input.id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function deleteShippingZone(id: string): Promise<void> {
  return executeShippingDelete((csrfToken) =>
    adminApiClient.DELETE('/api/v1/admin/shipping/zones/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function createShippingMethod(input: {
  readonly zoneId: string;
  readonly data: CreateMethodInput;
}) {
  return executeShippingRequest((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/shipping/zones/{zoneId}/methods', {
      body: input.data,
      params: { path: { zoneId: input.zoneId }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function updateShippingMethod(input: {
  readonly id: string;
  readonly data: UpdateMethodInput;
}) {
  return executeShippingRequest((csrfToken) =>
    adminApiClient.PATCH('/api/v1/admin/shipping/methods/{id}', {
      body: input.data,
      params: { path: { id: input.id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function deleteShippingMethod(id: string): Promise<void> {
  return executeShippingDelete((csrfToken) =>
    adminApiClient.DELETE('/api/v1/admin/shipping/methods/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function createShippingRule(input: {
  readonly methodId: string;
  readonly data: RateRuleInput;
}) {
  return executeShippingRequest((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/shipping/methods/{methodId}/rules', {
      body: input.data,
      params: { path: { methodId: input.methodId }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function updateShippingRule(input: {
  readonly id: string;
  readonly data: RateRuleInput;
}) {
  return executeShippingRequest((csrfToken) =>
    adminApiClient.PATCH('/api/v1/admin/shipping/rules/{id}', {
      body: input.data,
      params: { path: { id: input.id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

export async function deleteShippingRule(id: string): Promise<void> {
  return executeShippingDelete((csrfToken) =>
    adminApiClient.DELETE('/api/v1/admin/shipping/rules/{id}', {
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
}

function executeShippingRequest<T>(
  request: (csrfToken: string) => Promise<{
    readonly data?: T;
    readonly error?: unknown;
    readonly response: Response;
  }>,
): Promise<T> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() => request(csrfToken)),
  );
}

function executeShippingDelete(
  request: (csrfToken: string) => Promise<{
    readonly data?: unknown;
    readonly error?: unknown;
    readonly response: Response;
  }>,
): Promise<void> {
  return executeWithCsrf((csrfToken) =>
    executeEmptyApiRequest(() => request(csrfToken)),
  );
}
