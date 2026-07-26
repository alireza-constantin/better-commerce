import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { listCurrentPrices, setCurrentPrice } from './pricing-api';

export const pricingQueryKeys = {
  all: ['admin', 'pricing'] as const,
  current: (variantId: string) => [...pricingQueryKeys.all, 'current', variantId] as const,
};

export const currentPriceQueryOptions = (variantId: string) =>
  queryOptions({
    queryKey: pricingQueryKeys.current(variantId),
    queryFn: async () => (await listCurrentPrices([variantId]))[0],
    enabled: variantId.length > 0,
  });

export const setCurrentPriceMutationOptions = () =>
  mutationOptions({ mutationFn: setCurrentPrice });
