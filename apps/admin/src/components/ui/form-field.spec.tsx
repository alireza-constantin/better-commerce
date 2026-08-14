import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './form-field';
import { Input } from './input';

describe('FormField', () => {
  it('connects its label and validation message to the control', () => {
    render(
      <FormField error="نام کالا الزامی است" label="نام کالا" required>
        {(accessibility) => <Input {...accessibility} />}
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: 'نام کالا' });
    const error = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(error).toHaveTextContent('نام کالا الزامی است');
  });
});
