import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  readonly children: (accessibility: {
    readonly 'aria-describedby'?: string;
    readonly 'aria-invalid'?: true;
    readonly id: string;
  }) => ReactNode;
  readonly className?: string;
  readonly error?: string;
  readonly hint?: string;
  readonly label: string;
  readonly required?: boolean;
}

export function FormField({
  children,
  className,
  error,
  hint,
  label,
  required = false,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = `${generatedId}-control`;
  const descriptionId = hint || error ? `${generatedId}-description` : undefined;

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium" htmlFor={controlId}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-destructive">
            *
          </span>
        ) : null}
      </label>
      {children({
        id: controlId,
        ...(descriptionId ? { 'aria-describedby': descriptionId } : {}),
        ...(error ? { 'aria-invalid': true } : {}),
      })}
      {error || hint ? (
        <p
          className={cn(
            'text-xs leading-5',
            error ? 'text-destructive' : 'text-muted-foreground',
          )}
          id={descriptionId}
          role={error ? 'alert' : undefined}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
