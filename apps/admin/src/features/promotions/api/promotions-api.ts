import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';
import { adminApiClient, executeApiRequest } from '@/api/client';
import { executeWithCsrf } from '@/api/csrf';

export type Promotion = BetterCommerceApiSchemas['PromotionResponseDto'];
export type PromotionPage = BetterCommerceApiSchemas['PromotionPageResponseDto'];
export interface PromotionListQuery {
  readonly status?: Promotion['status'];
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}
export type CreatePromotionInput = BetterCommerceApiSchemas['CreatePromotionDto'];
export type ReplacePromotionInput = BetterCommerceApiSchemas['ReplacePromotionDefinitionDto'];
export interface PromotionLifecycleInput { readonly expectedVersion: number }
export type PromotionRedemptionPage = BetterCommerceApiSchemas['PromotionRedemptionPageResponseDto'];

export async function listPromotions(query: PromotionListQuery = {}): Promise<PromotionPage> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/promotions', { params: { query } }),
  );
}

export async function getPromotion(promotionId: string): Promise<Promotion> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/promotions/{promotionId}', {
      params: { path: { promotionId } },
    }),
  );
}

export async function listPromotionRedemptions(input: {
  readonly promotionId: string;
  readonly cursor?: string;
  readonly limit?: number;
}): Promise<PromotionRedemptionPage> {
  return executeApiRequest(() =>
    adminApiClient.GET('/api/v1/admin/promotions/{promotionId}/redemptions', {
      params: {
        path: { promotionId: input.promotionId },
        query: { cursor: input.cursor, limit: input.limit },
      },
    }),
  );
}

export async function createPromotion(input: CreatePromotionInput): Promise<Promotion> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST('/api/v1/admin/promotions', {
        body: input,
        params: { header: { 'x-csrf-token': csrfToken } },
      }),
    ),
  );
}

export async function replacePromotion(input: {
  readonly promotionId: string;
  readonly body: ReplacePromotionInput;
}): Promise<Promotion> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.PUT('/api/v1/admin/promotions/{promotionId}/definition', {
        body: input.body,
        params: {
          path: { promotionId: input.promotionId },
          header: { 'x-csrf-token': csrfToken },
        },
      }),
    ),
  );
}

export async function transitionPromotion(input: {
  readonly promotionId: string;
  readonly action: 'activate' | 'pause' | 'end';
  readonly body: PromotionLifecycleInput;
}): Promise<Promotion> {
  return executeWithCsrf((csrfToken) =>
    executeApiRequest(() =>
      adminApiClient.POST('/api/v1/admin/promotions/{promotionId}/{action}', {
        body: input.body,
        params: {
          path: { promotionId: input.promotionId, action: input.action },
          header: { 'x-csrf-token': csrfToken },
        },
      }),
    ),
  );
}
