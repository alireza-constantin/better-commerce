import { queryOptions } from '@tanstack/react-query';
import { getAdminProfile } from './auth-api';

export const adminSessionQueryKey = ['admin', 'session'] as const;

export const adminSessionQueryOptions = () =>
  queryOptions({
    queryKey: adminSessionQueryKey,
    queryFn: ({ signal }) => getAdminProfile(signal),
    retry: false,
    staleTime: 0,
  });
