import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { adminApiClient, executeApiRequest } from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type AdminProduct = BetterCommerceApiSchemas['ProductDetailResponseDto'];
export type AdminProductSummary = BetterCommerceApiSchemas['ProductSummaryResponseDto'];
export type AdminProductsPage = BetterCommerceApiSchemas['ProductPageResponseDto'];
export type CreatedAdminProduct = BetterCommerceApiSchemas['CreatedProductResponseDto'];
export type CreateProductInput = BetterCommerceApiSchemas['CreateProductDto'];
export type EditProductInput = BetterCommerceApiSchemas['EditProductDto'];
export type ProductConfigurationInput =
  BetterCommerceApiSchemas['ReplaceConfigurationDto'];

export interface AdminProductsListInput {
  readonly cursor?: string;
  readonly limit?: number;
  readonly q?: string;
  readonly sku?: string;
  readonly status?: 'draft' | 'published' | 'archived';
}

export async function listAdminProducts(
  input: AdminProductsListInput = {},
  signal?: AbortSignal,
): Promise<AdminProductsPage> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/catalog/products', {
      signal,
      params: { query: input },
    }),
  );
}

export async function getAdminProduct(
  productId: string,
  signal?: AbortSignal,
): Promise<AdminProduct> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/catalog/products/{productId}', {
      signal,
      params: { path: { productId } },
    }),
  );
}

export async function createAdminProduct(
  input: CreateProductInput,
): Promise<CreatedAdminProduct> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST('/api/v1/admin/catalog/products', {
        body: input,
        params: { header: { 'x-csrf-token': csrfToken } },
      }),
    ),
  );
}

export async function updateAdminProduct({
  productId,
  input,
}: {
  readonly productId: string;
  readonly input: EditProductInput;
}): Promise<AdminProduct> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.PATCH('/api/v1/admin/catalog/products/{productId}', {
        body: input,
        params: { path: { productId }, header: { 'x-csrf-token': csrfToken } },
      }),
    ),
  );
}

export async function replaceProductConfiguration({
  productId,
  input,
}: {
  readonly productId: string;
  readonly input: ProductConfigurationInput;
}): Promise<AdminProduct> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.PUT('/api/v1/admin/catalog/products/{productId}/configuration', {
        body: input,
        params: { path: { productId }, header: { 'x-csrf-token': csrfToken } },
      }),
    ),
  );
}

export async function transitionAdminProduct({
  productId,
  expectedVersion,
  action,
}: {
  readonly productId: string;
  readonly expectedVersion: number;
  readonly action: 'publish' | 'unpublish' | 'archive' | 'restore';
}): Promise<AdminProduct> {
  const path = `/api/v1/admin/catalog/products/{productId}/${action}` as const;
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST(path, {
        body: { expectedVersion },
        params: {
          path: { productId },
          header: { 'x-csrf-token': csrfToken },
        },
      }),
    ),
  );
}
