import type { DatabaseTransactionContext } from '../../platform/database';

export const COMMERCE_AUDIT_CONTRACT = Symbol('commerce-audit-contract');

export const CommerceAuditAction = {
  PRICE_CHANGED: 'pricing.price_changed',
  INVENTORY_CONFIGURED: 'inventory.configured',
  INVENTORY_ADJUSTED: 'inventory.adjusted',
  SHIPPING_ZONE_CREATED: 'shipping.zone_created',
  SHIPPING_ZONE_UPDATED: 'shipping.zone_updated',
  SHIPPING_ZONE_ARCHIVED: 'shipping.zone_archived',
  SHIPPING_METHOD_CREATED: 'shipping.method_created',
  SHIPPING_METHOD_UPDATED: 'shipping.method_updated',
  SHIPPING_METHOD_ARCHIVED: 'shipping.method_archived',
  SHIPPING_RULE_CREATED: 'shipping.rule_created',
  SHIPPING_RULE_UPDATED: 'shipping.rule_updated',
  SHIPPING_RULE_ARCHIVED: 'shipping.rule_archived',
  ORDER_SUBMITTED: 'orders.submitted',
  ORDER_ACCEPTED: 'orders.accepted',
  ORDER_REJECTED: 'orders.rejected',
  PAYMENT_CONFIRMED: 'payments.confirmed',
  CATEGORY_CREATED: 'catalog.category_created',
  CATEGORY_UPDATED: 'catalog.category_updated',
  CATEGORY_MOVED: 'catalog.category_moved',
  CATEGORY_ARCHIVED: 'catalog.category_archived',
  CATEGORY_RESTORED: 'catalog.category_restored',
  PRODUCT_CATEGORIES_REPLACED: 'catalog.product_categories_replaced',
  VARIANT_CONFIGURATION_REPLACED: 'catalog.variant_configuration_replaced',
  COLLECTION_CREATED: 'catalog.collection_created',
  COLLECTION_UPDATED: 'catalog.collection_updated',
  COLLECTION_ARCHIVED: 'catalog.collection_archived',
  COLLECTION_RESTORED: 'catalog.collection_restored',
  COLLECTION_PRODUCTS_REPLACED: 'catalog.collection_products_replaced',
  PROMOTION_CREATED: 'promotions.created',
  PROMOTION_UPDATED: 'promotions.updated',
  PROMOTION_ACTIVATED: 'promotions.activated',
  PROMOTION_PAUSED: 'promotions.paused',
  PROMOTION_ENDED: 'promotions.ended',
  PROMOTION_REDEEMED: 'promotions.redeemed',
} as const;

export type CommerceAuditAction =
  (typeof CommerceAuditAction)[keyof typeof CommerceAuditAction];

type AuditPrimitive = string | number | boolean | null;
export type CommerceAuditMetadata = Readonly<
  Record<string, AuditPrimitive | readonly AuditPrimitive[]>
>;

export interface CommerceAuditWrite {
  readonly actorUserId: string | null;
  readonly action: CommerceAuditAction;
  readonly targetType: string;
  readonly targetId: string;
  readonly requestId: string | null;
  readonly metadata: CommerceAuditMetadata;
}

export interface CommerceAuditContract {
  record(
    input: CommerceAuditWrite,
    transaction: DatabaseTransactionContext,
  ): Promise<void>;
}
