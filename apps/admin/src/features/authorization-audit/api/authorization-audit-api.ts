import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { adminApiClient, executeApiRequest } from '@/api/client';

export type AuthorizationAuditEvent =
  BetterCommerceApiSchemas['AuditEventResponseDto'];
export type AuthorizationAuditPage =
  BetterCommerceApiSchemas['AuditEventPageResponseDto'];

export interface AuthorizationAuditListInput {
  readonly action?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly targetId?: string;
  readonly targetType?: string;
}

/** Reads only the API's deliberately safe authorization-audit projection. */
export async function listAuthorizationAuditEvents(
  input: AuthorizationAuditListInput = {},
  signal?: AbortSignal,
): Promise<AuthorizationAuditPage> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/audit-events', {
      signal,
      params: {
        query: {
          action: input.action,
          cursor: input.cursor,
          // OpenAPI currently emits numeric query parameters as Object.
          limit: input.limit as never,
          targetId: input.targetId,
          targetType: input.targetType,
        },
      },
    }),
  );
}
