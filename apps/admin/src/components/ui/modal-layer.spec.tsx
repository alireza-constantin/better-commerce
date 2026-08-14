import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModalLayer } from './modal-layer';

describe('ModalLayer', () => {
  it('exposes a modal dialog and closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ModalLayer onClose={onClose} open title="بررسی تغییرات">
        <button type="button">تأیید</button>
      </ModalLayer>,
    );

    expect(
      screen.getByRole('dialog', { name: 'بررسی تغییرات' }),
    ).toHaveAttribute('aria-modal', 'true');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
