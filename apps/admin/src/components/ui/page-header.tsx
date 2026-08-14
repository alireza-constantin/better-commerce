import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
}

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-sm font-medium text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
