import {
  CommerceAuditAction,
  type CommerceAuditMetadata,
} from './commerce-audit.contract';

const ALLOWED_METADATA: Readonly<
  Record<CommerceAuditAction, readonly string[]>
> = Object.freeze({
  [CommerceAuditAction.PRICE_CHANGED]: ['priceVersionId', 'amount', 'currency'],
  [CommerceAuditAction.INVENTORY_CONFIGURED]: ['trackingMode', 'onHand'],
  [CommerceAuditAction.INVENTORY_ADJUSTED]: [
    'delta',
    'reasonCode',
    'resultingOnHand',
  ],
  [CommerceAuditAction.SHIPPING_ZONE_CREATED]: [],
  [CommerceAuditAction.SHIPPING_ZONE_UPDATED]: [],
  [CommerceAuditAction.SHIPPING_ZONE_ARCHIVED]: [],
  [CommerceAuditAction.SHIPPING_METHOD_CREATED]: ['zoneId'],
  [CommerceAuditAction.SHIPPING_METHOD_UPDATED]: ['zoneId'],
  [CommerceAuditAction.SHIPPING_METHOD_ARCHIVED]: ['zoneId'],
  [CommerceAuditAction.SHIPPING_RULE_CREATED]: ['methodId', 'currency'],
  [CommerceAuditAction.SHIPPING_RULE_UPDATED]: ['methodId', 'currency'],
  [CommerceAuditAction.SHIPPING_RULE_ARCHIVED]: ['methodId', 'currency'],
  [CommerceAuditAction.ORDER_SUBMITTED]: [
    'orderNumber',
    'paymentMethod',
    'grandTotal',
    'currency',
  ],
  [CommerceAuditAction.ORDER_ACCEPTED]: ['previousStatus'],
  [CommerceAuditAction.ORDER_REJECTED]: ['previousStatus'],
  [CommerceAuditAction.PAYMENT_CONFIRMED]: ['method', 'safeReference'],
  [CommerceAuditAction.CATEGORY_CREATED]: ['parentId', 'position'],
  [CommerceAuditAction.CATEGORY_UPDATED]: [],
  [CommerceAuditAction.CATEGORY_MOVED]: [
    'previousParentId',
    'parentId',
    'position',
  ],
  [CommerceAuditAction.CATEGORY_ARCHIVED]: [],
  [CommerceAuditAction.CATEGORY_RESTORED]: [],
  [CommerceAuditAction.PRODUCT_CATEGORIES_REPLACED]: ['categoryCount'],
  [CommerceAuditAction.COLLECTION_CREATED]: [],
  [CommerceAuditAction.COLLECTION_UPDATED]: [],
  [CommerceAuditAction.COLLECTION_ARCHIVED]: [],
  [CommerceAuditAction.COLLECTION_RESTORED]: [],
  [CommerceAuditAction.COLLECTION_PRODUCTS_REPLACED]: ['productCount'],
});

export function assertCommerceAuditMetadata(
  action: CommerceAuditAction,
  metadata: CommerceAuditMetadata,
): void {
  if (
    metadata === null ||
    Array.isArray(metadata) ||
    typeof metadata !== 'object'
  )
    throw new TypeError('Commerce audit metadata must be a JSON object');
  const allowed = new Set(ALLOWED_METADATA[action]);
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowed.has(key))
      throw new TypeError(
        `Commerce audit metadata key is not allowed for ${action}: ${key}`,
      );
    const values = Array.isArray(value) ? value : [value];
    if (
      values.some(
        (item) =>
          item !== null &&
          typeof item !== 'string' &&
          typeof item !== 'number' &&
          typeof item !== 'boolean',
      )
    )
      throw new TypeError(
        `Commerce audit metadata value is not safe for ${action}: ${key}`,
      );
  }
}
