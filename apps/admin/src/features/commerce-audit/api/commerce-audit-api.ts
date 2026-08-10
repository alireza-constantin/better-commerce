import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { adminApiClient, executeApiRequest } from '@/api/client';

export type CommerceAuditEvent =
  BetterCommerceApiSchemas['CommerceAuditEventResponseDto'];
export type CommerceAuditPage =
  BetterCommerceApiSchemas['CommerceAuditPageResponseDto'];

export interface CommerceAuditListInput {
  readonly cursor?: string;
  readonly limit?: number;
  readonly productId?: string;
}

export async function listCommerceAuditEvents(
  input: CommerceAuditListInput = {},
  signal?: AbortSignal,
): Promise<CommerceAuditPage> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/commerce-audit-events', {
      signal,
      params: {
        query: {
          cursor: input.cursor,
          productId: input.productId,
          // OpenAPI currently represents this numeric parameter as Object.
          limit: input.limit as never,
        },
      },
    }),
  );
}
