import { Link } from '@tanstack/react-router';
import {
  ChevronLeft,
  Menu,
  PanelRightClose,
} from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type {
  AdminNavigationGroup,
  AdminNavigationItem,
} from '@/app/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AdminStaffSummary {
  readonly email: string;
  readonly profileSummary?: string;
}

export interface AdminShellProps {
  readonly children: ReactNode;
  readonly navigation: readonly AdminNavigationGroup[];
  readonly activePath: string;
  readonly staff: AdminStaffSummary;
  readonly logoutAction: ReactNode;
  readonly productName?: string;
}

function navigationIsActive(item: AdminNavigationItem, activePath: string) {
  return activePath === item.path ||
    (item.path !== '/' && activePath.startsWith(`${item.path}/`));
}

/**
 * Presentation-only authenticated frame. Route and permission decisions stay
 * with its caller; this component only renders the supplied navigation state.
 */
export function AdminShell({
  activePath,
  children,
  logoutAction,
  navigation,
  productName = 'Better Commerce',
  staff,
}: AdminShellProps) {
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const navigationId = useId();
  const navigationToggleId = useId();
  const mainContentRef = useRef<HTMLElement>(null);
  const previousActivePathRef = useRef(activePath);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileNavigationOpen) {
        setIsMobileNavigationOpen(false);
        requestAnimationFrame(() => {
          document.getElementById(navigationToggleId)?.focus();
        });
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileNavigationOpen, navigationToggleId]);

  useEffect(() => {
    if (previousActivePathRef.current === activePath) {
      return;
    }

    previousActivePathRef.current = activePath;
    setIsMobileNavigationOpen(false);
    requestAnimationFrame(() => {
      mainContentRef.current?.focus();
    });
  }, [activePath]);

  const finishNavigation = () => {
    setIsMobileNavigationOpen(false);
    requestAnimationFrame(() => {
      mainContentRef.current?.focus();
    });
  };

  return (
    <div
      className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]"
      dir="rtl"
    >
      <aside className="hidden min-h-dvh border-e border-border bg-card lg:flex lg:flex-col">
        <ShellBrand productName={productName} />
        <ShellNavigation
          activePath={activePath}
          navigation={navigation}
          onNavigate={finishNavigation}
        />
        <StaffPanel logoutAction={logoutAction} staff={staff} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              <bdi dir="ltr">{productName}</bdi>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              مدیریت فروشگاه
            </p>
          </div>
          <Button
            aria-controls={navigationId}
            aria-expanded={isMobileNavigationOpen}
            aria-label={
              isMobileNavigationOpen ? 'بستن منوی مدیریت' : 'باز کردن منوی مدیریت'
            }
            onClick={() => setIsMobileNavigationOpen((open) => !open)}
            id={navigationToggleId}
            size="icon"
            variant="outline"
          >
            {isMobileNavigationOpen ? <PanelRightClose /> : <Menu />}
          </Button>
        </header>

        <div
          className={cn(
            'fixed inset-x-0 top-16 z-10 max-h-[calc(100dvh-4rem)] origin-top overflow-y-auto border-b border-border bg-card shadow-lg transition duration-200 ease-out lg:hidden',
            isMobileNavigationOpen
              ? 'visible translate-y-0 opacity-100'
              : 'invisible -translate-y-2 opacity-0',
          )}
          id={navigationId}
        >
          <ShellNavigation
            activePath={activePath}
          navigation={navigation}
          onNavigate={finishNavigation}
          />
          <StaffPanel logoutAction={logoutAction} staff={staff} />
        </div>

        <main
          className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10 lg:py-10"
          ref={mainContentRef}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellBrand({ productName }: { readonly productName: string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 border-b border-border px-5">
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
      >
        B
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">
          <bdi dir="ltr">{productName}</bdi>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">مدیریت فروشگاه</p>
      </div>
    </div>
  );
}

interface ShellNavigationProps {
  readonly activePath: string;
  readonly navigation: readonly AdminNavigationGroup[];
  readonly onNavigate: () => void;
}

function ShellNavigation({
  activePath,
  navigation,
  onNavigate,
}: ShellNavigationProps) {
  const groupHeadingPrefix = useId();

  return (
    <nav aria-label="ناوبری مدیریت" className="flex-1 px-3 py-4">
      <div className="space-y-5">
        {navigation.map((group, groupIndex) => {
          const headingId = `${groupHeadingPrefix}-${groupIndex}`;

          return (
          <section aria-labelledby={headingId} key={group.label}>
            <h2
              className="px-3 text-xs font-medium text-muted-foreground"
              id={headingId}
            >
              {group.label}
            </h2>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const isActive = navigationIsActive(item, activePath);
                const Icon = item.icon;

                return (
                  <li key={item.path}>
                    <Link
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        isActive
                          ? 'bg-secondary text-secondary-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                      )}
                      onClick={onNavigate}
                      to={item.path}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {isActive ? (
                        <ChevronLeft aria-hidden="true" className="size-4" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          );
        })}
      </div>
    </nav>
  );
}

interface StaffPanelProps {
  readonly logoutAction: ReactNode;
  readonly staff: AdminStaffSummary;
}

function StaffPanel({ logoutAction, staff }: StaffPanelProps) {
  return (
    <section aria-label="کاربر واردشده" className="border-t border-border px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            <bdi dir="ltr">{staff.email}</bdi>
          </p>
          {staff.profileSummary ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {staff.profileSummary}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">{logoutAction}</div>
      </div>
    </section>
  );
}
