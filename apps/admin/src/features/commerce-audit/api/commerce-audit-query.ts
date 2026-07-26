import { queryOptions } from '@tanstack/react-query';
import { listCommerceAuditEvents, type CommerceAuditListInput } from './commerce-audit-api';

export const commerceAuditQueryKeys = {
  all: ['commerce-audit'] as const,
  list: (input: CommerceAuditListInput) =>
    [...commerceAuditQueryKeys.all, 'list', input] as const,
};

export function commerceAuditListQueryOptions(input: CommerceAuditListInput) {
  return queryOptions({
    queryKey: commerceAuditQueryKeys.list(input),
    queryFn: ({ signal }) => listCommerceAuditEvents(input, signal),
  });
}
