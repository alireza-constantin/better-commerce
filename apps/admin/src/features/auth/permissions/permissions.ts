import type { BetterCommerceApiSchemas } from '@better-commerce/sdk';

/** A permission explicitly issued by the Admin API for the current staff member. */
export type AdminPermission =
  BetterCommerceApiSchemas['StaffProfileResponseDto']['permissions'][number];

/**
 * The server-returned permission collection. It is deliberately readonly so
 * authorization checks cannot change the authenticated session state.
 */
export type AdminPermissions = readonly AdminPermission[] | null | undefined;

/**
 * Returns whether a server-issued permission is present. Missing session data
 * is denied by default.
 */
export function hasPermission(
  permissions: AdminPermissions,
  requiredPermission: AdminPermission,
): boolean {
  return permissions?.includes(requiredPermission) ?? false;
}

/**
 * Returns whether every required server-issued permission is present.
 * Empty requirements are denied deliberately, so an incomplete route or UI
 * configuration cannot accidentally grant access.
 */
export function hasAllPermissions(
  permissions: AdminPermissions,
  requiredPermissions: readonly AdminPermission[],
): boolean {
  return (
    requiredPermissions.length > 0 &&
    requiredPermissions.every((permission) => hasPermission(permissions, permission))
  );
}

/**
 * Returns whether at least one required server-issued permission is present.
 * Empty requirements and missing session data are denied by default.
 */
export function hasAnyPermission(
  permissions: AdminPermissions,
  requiredPermissions: readonly AdminPermission[],
): boolean {
  return requiredPermissions.some((permission) =>
    hasPermission(permissions, permission),
  );
}
