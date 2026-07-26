import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { adminApiClient, executeApiRequest } from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type CurrentPrice = BetterCommerceApiSchemas['CurrentPriceResponseDto'];
export type PriceVersion = BetterCommerceApiSchemas['PriceResponseDto'];
export type SetPriceInput = BetterCommerceApiSchemas['SetPriceDto'];

export async function listCurrentPrices(
  variantIds: readonly string[],
): Promise<readonly CurrentPrice[]> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST('/api/v1/admin/pricing/current', {
        body: { variantIds },
        params: { header: { 'x-csrf-token': csrfToken } },
      }),
    ),
  );
}

export async function setCurrentPrice(input: {
  readonly variantId: string;
  readonly amount: string;
}): Promise<PriceVersion> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST('/api/v1/admin/pricing/variants/{variantId}', {
        body: { amount: input.amount } satisfies SetPriceInput,
        params: {
          path: { variantId: input.variantId },
          header: { 'x-csrf-token': csrfToken },
        },
      }),
    ),
  );
}
