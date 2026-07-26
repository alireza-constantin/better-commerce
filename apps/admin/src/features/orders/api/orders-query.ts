import { mutationOptions, queryOptions } from '@tanstack/react-query';
import {
  acceptAdminOrder,
  confirmManualPayment,
  getAdminOrder,
  listAdminOrders,
  rejectAdminOrder,
  type AdminOrdersListInput,
} from './orders-api';

export const adminOrdersQueryKeys = {
  all: ['admin', 'orders'] as const,
  lists: () => [...adminOrdersQueryKeys.all, 'list'] as const,
  list: (input: AdminOrdersListInput = {}) =>
    [...adminOrdersQueryKeys.lists(), input] as const,
  details: () => [...adminOrdersQueryKeys.all, 'detail'] as const,
  detail: (orderId: string) =>
    [...adminOrdersQueryKeys.details(), orderId] as const,
};

export const adminOrdersListQueryOptions = (
  input: AdminOrdersListInput = {},
) =>
  queryOptions({
    queryKey: adminOrdersQueryKeys.list(input),
    queryFn: ({ signal }) => listAdminOrders(input, signal),
  });

export const adminOrderDetailQueryOptions = (orderId: string) =>
  queryOptions({
    queryKey: adminOrdersQueryKeys.detail(orderId),
    queryFn: ({ signal }) => getAdminOrder(orderId, signal),
    enabled: orderId.length > 0,
  });

// These mutations deliberately do not optimistically change cached orders.
// Callers should invalidate the affected detail and list after success.
export const confirmManualPaymentMutationOptions = () =>
  mutationOptions({ mutationFn: confirmManualPayment });

export const acceptAdminOrderMutationOptions = () =>
  mutationOptions({ mutationFn: acceptAdminOrder });

export const rejectAdminOrderMutationOptions = () =>
  mutationOptions({ mutationFn: rejectAdminOrder });
