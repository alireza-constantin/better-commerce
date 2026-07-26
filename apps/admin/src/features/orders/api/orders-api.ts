import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { adminApiClient, executeApiRequest } from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type AdminOrder = BetterCommerceApiSchemas['OrderResponseDto'];
export type AdminOrdersPage = BetterCommerceApiSchemas['OrdersPageResponseDto'];
export type ManualPayment = BetterCommerceApiSchemas['ManualPaymentResponseDto'];
export type OrderDecision = BetterCommerceApiSchemas['OrderDecisionDto'];
export type ManualPaymentConfirmation =
  BetterCommerceApiSchemas['ConfirmManualPaymentDto'];

export interface AdminOrdersListInput {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface OrderDecisionInput {
  readonly orderId: string;
  readonly decision: OrderDecision;
}

export interface ManualPaymentConfirmationInput {
  readonly orderId: string;
  readonly confirmation: ManualPaymentConfirmation;
}

export async function listAdminOrders(
  input: AdminOrdersListInput = {},
  signal?: AbortSignal,
): Promise<AdminOrdersPage> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/orders', {
      signal,
      params: {
        query: {
          cursor: input.cursor,
          // The generated schema currently represents the numeric OpenAPI
          // query parameter as Object. Preserve the runtime number exactly.
          limit: input.limit as never,
        },
      },
    }),
  );
}

export async function getAdminOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<AdminOrder> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/orders/{orderId}', {
      signal,
      params: { path: { orderId } },
    }),
  );
}

export async function confirmManualPayment(
  input: ManualPaymentConfirmationInput,
): Promise<ManualPayment> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST('/api/v1/admin/orders/{orderId}/payment/confirm', {
        body: input.confirmation,
        params: {
          path: { orderId: input.orderId },
          header: { 'x-csrf-token': csrfToken },
        },
      }),
    ),
  );
}

export async function acceptAdminOrder(
  input: OrderDecisionInput,
): Promise<AdminOrder> {
  return executeOrderDecision('/api/v1/admin/orders/{orderId}/accept', input);
}

export async function rejectAdminOrder(
  input: OrderDecisionInput,
): Promise<AdminOrder> {
  return executeOrderDecision('/api/v1/admin/orders/{orderId}/reject', input);
}

async function executeOrderDecision(
  path:
    | '/api/v1/admin/orders/{orderId}/accept'
    | '/api/v1/admin/orders/{orderId}/reject',
  input: OrderDecisionInput,
): Promise<AdminOrder> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST(path, {
        body: input.decision,
        params: {
          path: { orderId: input.orderId },
          header: { 'x-csrf-token': csrfToken },
        },
      }),
    ),
  );
}
