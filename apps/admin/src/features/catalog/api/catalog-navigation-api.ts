import { adminApiClient, executeApiRequest } from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type GroupingStatus = 'active' | 'archived';
export interface AdminCategory {
  id: string;
  version: number;
  status: GroupingStatus;
  title: string;
  summary: string | null;
  description: string | null;
  slug: string;
  parentId: string | null;
  position: number;
  aliases: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AdminCollection {
  id: string;
  version: number;
  status: GroupingStatus;
  title: string;
  summary: string | null;
  description: string | null;
  slug: string;
  aliases: string[];
  products: { productId: string; position: number }[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface GroupingTextInput {
  title: string;
  slug: string;
  summary?: string | null;
  description?: string | null;
}
type ApiResponse = {
  readonly data?: unknown;
  readonly error?: unknown;
  readonly response: Response;
};
const read = <T>(work: () => Promise<ApiResponse>) =>
  executeApiRequest(work) as Promise<T>;
const write = <T>(work: (csrfToken: string) => Promise<ApiResponse>) =>
  executeWithCsrf((csrfToken) => read<T>(() => work(csrfToken)));

export const listAdminCategories = (signal?: AbortSignal) =>
  read<{ items: AdminCategory[]; nextCursor: string | null }>(() =>
    adminApiClient.GET('/api/v1/admin/catalog/categories', { signal }),
  );
export const getAdminCategory = (id: string, signal?: AbortSignal) =>
  read<AdminCategory>(() =>
    adminApiClient.GET('/api/v1/admin/catalog/categories/{id}', {
      params: { path: { id } },
      signal,
    }),
  );
export const createAdminCategory = (
  input: GroupingTextInput & { parentId?: string | null; position: number },
) =>
  write<AdminCategory>((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/catalog/categories', {
      body: input,
      params: { header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const updateAdminCategory = (
  id: string,
  input: GroupingTextInput & { expectedVersion: number },
) =>
  write<AdminCategory>((csrfToken) =>
    adminApiClient.PATCH('/api/v1/admin/catalog/categories/{id}', {
      body: input,
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const moveAdminCategory = (
  id: string,
  input: { expectedVersion: number; parentId: string | null; position: number },
) =>
  write<AdminCategory>((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/catalog/categories/{id}/move', {
      body: input,
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const transitionAdminCategory = (
  id: string,
  action: 'archive' | 'restore',
  expectedVersion: number,
) =>
  write<AdminCategory>((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/catalog/categories/{id}/{action}', {
      body: { expectedVersion },
      params: { path: { id, action }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const replaceAdminProductCategories = (
  id: string,
  expectedVersion: number,
  categoryIds: string[],
) =>
  write<{ productId: string; version: number }>((csrfToken) =>
    adminApiClient.PUT('/api/v1/admin/catalog/products/{id}/categories', {
      body: { expectedVersion, categoryIds },
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const listAdminCollections = (signal?: AbortSignal) =>
  read<{ items: AdminCollection[]; nextCursor: string | null }>(() =>
    adminApiClient.GET('/api/v1/admin/catalog/collections', { signal }),
  );
export const getAdminCollection = (id: string, signal?: AbortSignal) =>
  read<AdminCollection>(() =>
    adminApiClient.GET('/api/v1/admin/catalog/collections/{id}', {
      params: { path: { id } },
      signal,
    }),
  );
export const createAdminCollection = (input: GroupingTextInput) =>
  write<AdminCollection>((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/catalog/collections', {
      body: input,
      params: { header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const updateAdminCollection = (
  id: string,
  input: GroupingTextInput & { expectedVersion: number },
) =>
  write<AdminCollection>((csrfToken) =>
    adminApiClient.PATCH('/api/v1/admin/catalog/collections/{id}', {
      body: input,
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const replaceAdminCollectionProducts = (
  id: string,
  expectedVersion: number,
  items: { productId: string; position: number }[],
) =>
  write<AdminCollection>((csrfToken) =>
    adminApiClient.PUT('/api/v1/admin/catalog/collections/{id}/products', {
      body: { expectedVersion, items },
      params: { path: { id }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
export const transitionAdminCollection = (
  id: string,
  action: 'archive' | 'restore',
  expectedVersion: number,
) =>
  write<AdminCollection>((csrfToken) =>
    adminApiClient.POST('/api/v1/admin/catalog/collections/{id}/{action}', {
      body: { expectedVersion },
      params: { path: { id, action }, header: { 'x-csrf-token': csrfToken } },
    }),
  );
