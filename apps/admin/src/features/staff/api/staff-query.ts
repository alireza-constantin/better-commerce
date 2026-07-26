import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { activateStaff, createStaff, getRoles, getStaff, replaceStaffRoles, suspendStaff } from './staff-api';

export const staffQueryKeys = {
  all: ['admin', 'staff'] as const,
  list: (cursor?: string) => [...staffQueryKeys.all, 'list', cursor ?? 'first'] as const,
  roles: () => [...staffQueryKeys.all, 'roles'] as const,
};

export const staffListQueryOptions = (cursor?: string) => queryOptions({
  queryKey: staffQueryKeys.list(cursor), queryFn: ({ signal }) => getStaff(cursor, signal),
});
export const staffRolesQueryOptions = (enabled = true) => queryOptions({
  enabled,
  queryKey: staffQueryKeys.roles(), queryFn: ({ signal }) => getRoles(signal),
});
export const createStaffMutationOptions = () => mutationOptions({ mutationFn: createStaff });
export const replaceStaffRolesMutationOptions = () => mutationOptions({ mutationFn: replaceStaffRoles });
export const suspendStaffMutationOptions = () => mutationOptions({ mutationFn: suspendStaff });
export const activateStaffMutationOptions = () => mutationOptions({ mutationFn: activateStaff });
