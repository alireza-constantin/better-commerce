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
