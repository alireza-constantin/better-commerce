import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/12 text-amber-800',
  destructive: 'bg-destructive/10 text-destructive',
} as const;

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: keyof typeof tones;
}

export function StatusBadge({
  className,
  tone = 'neutral',
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
