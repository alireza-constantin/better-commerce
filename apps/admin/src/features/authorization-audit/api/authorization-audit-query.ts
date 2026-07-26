import { queryOptions } from '@tanstack/react-query';
import {
  listAuthorizationAuditEvents,
  type AuthorizationAuditListInput,
} from './authorization-audit-api';

export const authorizationAuditQueryKeys = {
  all: ['admin', 'authorization-audit'] as const,
  lists: () => [...authorizationAuditQueryKeys.all, 'list'] as const,
  list: (input: AuthorizationAuditListInput = {}) =>
    [...authorizationAuditQueryKeys.lists(), input] as const,
};

export const authorizationAuditListQueryOptions = (
  input: AuthorizationAuditListInput = {},
) =>
  queryOptions({
    queryKey: authorizationAuditQueryKeys.list(input),
    queryFn: ({ signal }) => listAuthorizationAuditEvents(input, signal),
  });
