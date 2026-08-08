import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { adminApiClient, executeApiRequest } from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type Inventory = BetterCommerceApiSchemas['InventoryResponseDto'];
export type ConfigureInventory =
  BetterCommerceApiSchemas['ConfigureInventoryDto'];
export type AdjustInventory = BetterCommerceApiSchemas['AdjustInventoryDto'];
export type CurrentInventory =
  BetterCommerceApiSchemas['CurrentInventoryResponseDto'];

export async function listCurrentInventory(
  variantIds: readonly string[],
): Promise<readonly CurrentInventory[]> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST('/api/v1/admin/inventory/variants/current', {
        body: { variantIds },
        params: { header: { 'x-csrf-token': csrfToken } },
      }),
    ),
  );
}

export async function configureInventory(input: {
  readonly variantId: string;
  readonly data: ConfigureInventory;
}): Promise<Inventory> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST(
        '/api/v1/admin/inventory/variants/{variantId}/configure',
        {
          body: input.data,
          params: {
            path: { variantId: input.variantId },
            header: { 'x-csrf-token': csrfToken },
          },
        },
      ),
    ),
  );
}
export async function adjustInventory(input: {
  readonly variantId: string;
  readonly data: AdjustInventory;
}): Promise<Inventory> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST(
        '/api/v1/admin/inventory/variants/{variantId}/adjust',
        {
          body: input.data,
          params: {
            path: { variantId: input.variantId },
            header: { 'x-csrf-token': csrfToken },
          },
        },
      ),
    ),
  );
}
