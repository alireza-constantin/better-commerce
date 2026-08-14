import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones: Record<
  'error' | 'info' | 'success' | 'warning',
  { readonly icon: LucideIcon; readonly className: string }
> = {
  error: {
    icon: AlertCircle,
    className: 'border-destructive/25 bg-destructive/5 text-destructive',
  },
  info: { icon: Info, className: 'border-info/20 bg-info/5 text-info' },
  success: {
    icon: CheckCircle2,
    className: 'border-success/20 bg-success/5 text-success',
  },
  warning: {
    icon: TriangleAlert,
    className: 'border-warning/30 bg-warning/8 text-amber-800',
  },
};

interface FeedbackPanelProps {
  readonly action?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly title: string;
  readonly tone?: keyof typeof tones;
}

export function FeedbackPanel({
  action,
  children,
  className,
  title,
  tone = 'info',
}: FeedbackPanelProps) {
  const presentation = tones[tone];
  const Icon = presentation.icon;

  return (
    <section
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        presentation.className,
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {children ? (
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </section>
  );
}
