import { IS_PUBLIC_ROUTE } from '../platform/http/authentication';
import {
  ADMIN_API_METADATA,
  REQUIRED_PERMISSIONS_METADATA,
} from '../modules/authorization/enforcement/authorization.constants';
import { PermissionKey } from '../modules/authorization/data';
import { InventoryAdminController } from '../modules/inventory/inventory.controller';
import {
  AdminOrdersController,
  CustomerOrdersController,
} from '../modules/orders/orders.controller';
import { PricingAdminController } from '../modules/pricing/pricing.controller';
import { ShippingAdminController } from '../modules/shipping/shipping.controller';
import { CommerceAuditController } from '../modules/commerce-audit/commerce-audit.controller';

type ControllerClass = { prototype: Record<string, unknown> };
interface PermissionMetadata {
  readonly permissions: readonly PermissionKey[];
}

function handler(controller: ControllerClass, method: string): object {
  const value = controller.prototype[method];
  if (typeof value !== 'function')
    throw new Error(`Missing controller handler ${method}`);
  return value;
}

function requirement(
  controller: ControllerClass,
  method: string,
): readonly PermissionKey[] {
  const metadata: unknown = Reflect.getMetadata(
    REQUIRED_PERMISSIONS_METADATA,
    handler(controller, method),
  );
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('permissions' in metadata) ||
    !Array.isArray((metadata as PermissionMetadata).permissions)
  )
    return [];
  return (metadata as PermissionMetadata).permissions;
}

describe('commerce HTTP authorization metadata', () => {
  it.each([
    PricingAdminController,
    InventoryAdminController,
    ShippingAdminController,
    AdminOrdersController,
    CommerceAuditController,
  ])('marks %p as an administrative API', (controller) => {
    expect(Reflect.getMetadata(ADMIN_API_METADATA, controller)).toBe(true);
  });

  it.each([
    [PricingAdminController, 'set', PermissionKey.PRICING_WRITE],
    [PricingAdminController, 'list', PermissionKey.PRICING_READ],
    [InventoryAdminController, 'configure', PermissionKey.INVENTORY_ADJUST],
    [InventoryAdminController, 'adjust', PermissionKey.INVENTORY_ADJUST],
    [ShippingAdminController, 'list', PermissionKey.SHIPPING_READ],
    [ShippingAdminController, 'createZone', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'updateZone', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'deleteZone', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'createMethod', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'updateMethod', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'deleteMethod', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'createRule', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'updateRule', PermissionKey.SHIPPING_WRITE],
    [ShippingAdminController, 'deleteRule', PermissionKey.SHIPPING_WRITE],
    [AdminOrdersController, 'list', PermissionKey.ORDERS_READ],
    [AdminOrdersController, 'detail', PermissionKey.ORDERS_READ],
    [
      AdminOrdersController,
      'confirmPayment',
      PermissionKey.PAYMENTS_MANUAL_CONFIRM,
    ],
    [AdminOrdersController, 'accept', PermissionKey.ORDERS_ACCEPT],
    [AdminOrdersController, 'reject', PermissionKey.ORDERS_REJECT],
    [CommerceAuditController, 'list', PermissionKey.AUDIT_READ],
  ] as const)('%p.%s requires %s', (controller, method, expectedPermission) => {
    expect(requirement(controller, method)).toEqual([expectedPermission]);
  });

  it('keeps customer order routes authenticated by default', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_ROUTE, CustomerOrdersController),
    ).not.toBe(true);
    for (const method of ['submit', 'list', 'detail']) {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_ROUTE,
          handler(CustomerOrdersController, method),
        ),
      ).not.toBe(true);
    }
  });
});
