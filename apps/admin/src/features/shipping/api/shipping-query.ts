import { mutationOptions, queryOptions } from '@tanstack/react-query';
import {
  createShippingMethod,
  createShippingRule,
  createShippingZone,
  deleteShippingMethod,
  deleteShippingRule,
  deleteShippingZone,
  getShippingConfiguration,
  updateShippingMethod,
  updateShippingRule,
  updateShippingZone,
} from './shipping-api';

export const shippingQueryKeys = {
  all: ['admin', 'shipping'] as const,
  configuration: () => [...shippingQueryKeys.all, 'configuration'] as const,
};

export const shippingConfigurationQueryOptions = () =>
  queryOptions({
    queryKey: shippingQueryKeys.configuration(),
    queryFn: ({ signal }) => getShippingConfiguration(signal),
  });

// Mutations intentionally leave the cache unchanged. The route invalidates the
// server-owned configuration only after a confirmed successful response.
export const createShippingZoneMutationOptions = () =>
  mutationOptions({ mutationFn: createShippingZone });
export const updateShippingZoneMutationOptions = () =>
  mutationOptions({ mutationFn: updateShippingZone });
export const deleteShippingZoneMutationOptions = () =>
  mutationOptions({ mutationFn: deleteShippingZone });
export const createShippingMethodMutationOptions = () =>
  mutationOptions({ mutationFn: createShippingMethod });
export const updateShippingMethodMutationOptions = () =>
  mutationOptions({ mutationFn: updateShippingMethod });
export const deleteShippingMethodMutationOptions = () =>
  mutationOptions({ mutationFn: deleteShippingMethod });
export const createShippingRuleMutationOptions = () =>
  mutationOptions({ mutationFn: createShippingRule });
export const updateShippingRuleMutationOptions = () =>
  mutationOptions({ mutationFn: updateShippingRule });
export const deleteShippingRuleMutationOptions = () =>
  mutationOptions({ mutationFn: deleteShippingRule });
