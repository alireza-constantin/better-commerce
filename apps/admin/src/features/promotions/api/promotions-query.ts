import { mutationOptions, queryOptions } from '@tanstack/react-query';
import {
  createPromotion,
  getPromotion,
  listPromotions,
  listPromotionRedemptions,
  replacePromotion,
  transitionPromotion,
} from './promotions-api';

export const promotionsQueryKeys = {
  all: ['admin', 'promotions'] as const,
  list: (query: object = {}) => [...promotionsQueryKeys.all, 'list', query] as const,
  detail: (promotionId: string) => [...promotionsQueryKeys.all, 'detail', promotionId] as const,
};

export const promotionsListQueryOptions = (query: Parameters<typeof listPromotions>[0] = {}) =>
  queryOptions({
    queryKey: promotionsQueryKeys.list(query),
    queryFn: () => listPromotions(query),
  });

export const promotionQueryOptions = (promotionId: string) =>
  queryOptions({
    queryKey: promotionsQueryKeys.detail(promotionId),
    queryFn: () => getPromotion(promotionId),
    enabled: promotionId.length > 0,
  });

export const promotionRedemptionsQueryOptions = (promotionId: string) =>
  queryOptions({
    queryKey: [...promotionsQueryKeys.detail(promotionId), 'redemptions'] as const,
    queryFn: () => listPromotionRedemptions({ promotionId, limit: 25 }),
    enabled: promotionId.length > 0,
  });

export const createPromotionMutationOptions = () => mutationOptions({ mutationFn: createPromotion });
export const replacePromotionMutationOptions = () => mutationOptions({ mutationFn: replacePromotion });
export const transitionPromotionMutationOptions = () => mutationOptions({ mutationFn: transitionPromotion });
