import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetail } from './order-detail';
import type { AdminOrder } from './order-presenters';

const order: AdminOrder = {
  acceptedAt: null,
  cancelledAt: null,
  currency: 'IRR',
  deliveryAddress: {
    city: 'تهران',
    country: 'IR',
    line1: 'خیابان نمونه',
    phone: '+982100000000',
    postalCode: '1234567890',
    province: 'تهران',
    recipientName: 'مشتری نمونه',
  },
  grandTotal: '125000.00',
  id: 'order-1',
  lines: [{
    fulfillmentClassification: 'physical',
    lineAmount: '125000.00',
    priceVersionId: 'price-1',
    productId: 'product-1',
    productTitle: 'کالای نمونه',
    quantity: 1,
    sku: 'SKU-1',
    unitAmount: '125000.00',
    variantId: 'variant-1',
    variantTitle: 'گونه نمونه',
  }],
  merchandiseSubtotal: '120000.00',
  orderNumber: '1001',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'pending_collection',
  shippingAmount: '5000.00',
  shippingMethodTitle: 'ارسال عادی',
  status: 'submitted',
  submittedAt: '2026-08-15T00:00:00.000Z',
};

describe('OrderDetail', () => {
  it('requires explicit confirmation before accepting an order', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    render(
      <OrderDetail
        actions={{ onAccept }}
        availability={{ canAccept: true }}
        order={order}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'پذیرش سفارش' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'پذیرش سفارش' });
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(submit);
    expect(onAccept).toHaveBeenCalledWith({ note: undefined });
  });
});
