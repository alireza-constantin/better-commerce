import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import {
  adminApiClient,
  executeApiRequest,
} from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type StaffPage = BetterCommerceApiSchemas['StaffPageResponseDto'];
export type StaffProfile = BetterCommerceApiSchemas['StaffProfileResponseDto'];
export type StaffRole = BetterCommerceApiSchemas['RoleResponseDto'];
export type CreateStaffInput = BetterCommerceApiSchemas['CreateStaffDto'];

export async function getStaff(cursor?: string, signal?: AbortSignal): Promise<StaffPage> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/staff', {
      params: { query: { cursor, limit: 25 as never } }, signal,
    }),
  );
}

export async function getRoles(signal?: AbortSignal): Promise<readonly StaffRole[]> {
  return executeApiRequest(() => adminApiClient.GET('/api/v1/admin/roles', { signal }));
}

export async function createStaff(input: CreateStaffInput): Promise<StaffProfile> {
  return withCsrf((csrfToken) => adminApiClient.POST('/api/v1/admin/staff', {
    body: input, params: { header: { 'x-csrf-token': csrfToken } },
  }));
}

export async function replaceStaffRoles(input: { readonly userId: string; readonly roleKeys: readonly string[] }): Promise<StaffProfile> {
  return withCsrf((csrfToken) => adminApiClient.PUT('/api/v1/admin/staff/{userId}/roles', {
    body: { roleKeys: input.roleKeys },
    params: { path: { userId: input.userId }, header: { 'x-csrf-token': csrfToken } },
  }));
}

export async function suspendStaff(userId: string): Promise<StaffProfile> {
  return withCsrf((csrfToken) => adminApiClient.POST('/api/v1/admin/staff/{userId}/suspend', {
    params: { path: { userId }, header: { 'x-csrf-token': csrfToken } },
  }));
}

export async function activateStaff(userId: string): Promise<StaffProfile> {
  return withCsrf((csrfToken) => adminApiClient.POST('/api/v1/admin/staff/{userId}/activate', {
    params: { path: { userId }, header: { 'x-csrf-token': csrfToken } },
  }));
}

function withCsrf<T>(request: (csrfToken: string) => Promise<{ readonly data?: T; readonly error?: unknown; readonly response: Response }>): Promise<T> {
  return executeWithCsrf((csrfToken) => executeApiRequest(() => request(csrfToken)));
}
