import { assertCommerceAuditMetadata } from './commerce-audit.catalogue';
import { CommerceAuditAction } from './commerce-audit.contract';

describe('commerce audit metadata', () => {
  it('accepts only action-specific safe primitive fields', () => {
    expect(() =>
      assertCommerceAuditMetadata(CommerceAuditAction.ORDER_SUBMITTED, {
        orderNumber: '1001',
        paymentMethod: 'cash_on_delivery',
        grandTotal: '21.00',
        currency: 'USD',
      }),
    ).not.toThrow();
  });

  it('rejects sensitive, unknown, and structured values', () => {
    expect(() =>
      assertCommerceAuditMetadata(CommerceAuditAction.ORDER_SUBMITTED, {
        password: 'secret',
      }),
    ).toThrow('not allowed');
    expect(() =>
      assertCommerceAuditMetadata(CommerceAuditAction.ORDER_SUBMITTED, {
        orderNumber: { nested: true } as never,
      }),
    ).toThrow('not safe');
  });
});
