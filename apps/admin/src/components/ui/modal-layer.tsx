import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalLayerProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly placement?: 'center' | 'side';
  readonly title: string;
}

export function ModalLayer({
  children,
  className,
  onClose,
  open,
  placement = 'center',
  title,
}: ModalLayerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        focusableSelector,
      );
      (firstFocusable ?? panelRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start',
        placement === 'side' ? 'justify-start p-0' : 'justify-center p-3 sm:p-6',
      )}
    >
      <button
        aria-label="بستن پنجره"
        className="absolute inset-0 cursor-default bg-foreground/35 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          'relative z-10 max-h-full w-full overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl outline-none',
          className,
        )}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="sr-only" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
