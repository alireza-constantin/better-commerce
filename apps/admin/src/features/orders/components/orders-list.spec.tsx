import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrdersList } from './orders-list';
import type { AdminOrdersPage } from './order-presenters';

describe('OrdersList', () => {
  it('offers the same order from responsive card and table presentations', async () => {
    const user = userEvent.setup();
    const onOrderSelect = vi.fn();
    const page = {
      items: [
        {
          id: 'order-1',
          orderNumber: '1001',
          submittedAt: '2026-08-15T00:00:00.000Z',
          status: 'submitted',
          paymentStatus: 'pending_manual_review',
          grandTotal: '125000.00',
          currency: 'IRR',
        },
      ],
      nextCursor: null,
    } as unknown as AdminOrdersPage;

    render(<OrdersList onOrderSelect={onOrderSelect} page={page} />);

    expect(screen.getByRole('table', { name: 'فهرست سفارش‌های ثبت‌شده فروشگاه' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'مشاهده سفارش 1001' })[0]!);
    expect(onOrderSelect).toHaveBeenCalledWith('order-1');
  });
});
