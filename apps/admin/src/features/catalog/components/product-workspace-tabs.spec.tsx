import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProductWorkspaceTabs } from './product-workspace-tabs';

describe('ProductWorkspaceTabs', () => {
  it('announces and requests the selected URL-backed workspace tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ProductWorkspaceTabs onChange={onChange} value="general" />);

    expect(screen.getByRole('tab', { name: 'اطلاعات' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('tab', { name: 'تصاویر' }));
    expect(onChange).toHaveBeenCalledWith('media');
  });
});
