import { Link } from '@tanstack/react-router';
import {
  ChevronLeft,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import type {
  AdminNavigationGroup,
  AdminNavigationItem,
} from '@/app/navigation';
import { Button, Input, ModalLayer } from '@/components/ui';
import { cn } from '@/lib/utils';

const SIDEBAR_PREFERENCE_KEY = 'better-commerce.admin.sidebar-collapsed';

function initialSidebarPreference() {
  try {
    return localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

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
  return (
    activePath === item.path ||
    (item.path !== '/' && activePath.startsWith(`${item.path}/`))
  );
}

/**
 * Presentation-only authenticated frame. Route and permission decisions stay
 * with its caller; this module owns responsive navigation and focus behavior.
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    initialSidebarPreference,
  );
  const mainContentRef = useRef<HTMLElement>(null);
  const previousActivePathRef = useRef(activePath);

  useEffect(() => {
    try {
      localStorage.setItem(
        SIDEBAR_PREFERENCE_KEY,
        String(isSidebarCollapsed),
      );
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.matches('input, textarea, select, [contenteditable="true"]') ??
        false;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      } else if (!isEditing && event.key === '/') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, []);

  useEffect(() => {
    if (previousActivePathRef.current === activePath) return;
    previousActivePathRef.current = activePath;
    setIsMobileNavigationOpen(false);
    setIsSearchOpen(false);
    requestAnimationFrame(() => mainContentRef.current?.focus());
  }, [activePath]);

  const finishNavigation = () => {
    setIsMobileNavigationOpen(false);
    setIsSearchOpen(false);
  };

  return (
    <div
      className={cn(
        'min-h-dvh bg-background text-foreground lg:grid',
        isSidebarCollapsed
          ? 'lg:grid-cols-[5rem_minmax(0,1fr)]'
          : 'lg:grid-cols-[17.5rem_minmax(0,1fr)]',
      )}
      dir="rtl"
    >
      <aside className="sticky top-0 hidden h-dvh border-e border-border bg-card lg:flex lg:flex-col">
        <ShellBrand
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((value) => !value)}
          productName={productName}
        />
        <ShellNavigation
          activePath={activePath}
          collapsed={isSidebarCollapsed}
          navigation={navigation}
          onNavigate={finishNavigation}
        />
        <StaffPanel
          collapsed={isSidebarCollapsed}
          logoutAction={logoutAction}
          staff={staff}
        />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6 lg:px-10">
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold tracking-tight" dir="ltr">
              {productName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              مدیریت فروشگاه
            </p>
          </div>
          <SearchTrigger onClick={() => setIsSearchOpen(true)} />
          <Button
            aria-expanded={isMobileNavigationOpen}
            aria-haspopup="dialog"
            aria-label="باز کردن منوی مدیریت"
            className="lg:hidden"
            onClick={() => setIsMobileNavigationOpen(true)}
            size="icon"
            variant="outline"
          >
            <Menu />
          </Button>
        </header>

        <main
          className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10 lg:py-9"
          ref={mainContentRef}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      <ModalLayer
        className="h-full max-w-sm rounded-none sm:rounded-s-2xl"
        onClose={() => setIsMobileNavigationOpen(false)}
        open={isMobileNavigationOpen}
        placement="side"
        title="منوی مدیریت"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex min-h-16 items-center justify-between border-b border-border px-4">
            <p className="font-semibold">منوی مدیریت</p>
            <Button
              aria-label="بستن منوی مدیریت"
              onClick={() => setIsMobileNavigationOpen(false)}
              size="icon"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
          <ShellNavigation
            activePath={activePath}
            collapsed={false}
            navigation={navigation}
            onNavigate={finishNavigation}
          />
          <StaffPanel
            collapsed={false}
            logoutAction={logoutAction}
            staff={staff}
          />
        </div>
      </ModalLayer>

      <SearchDialog
        navigation={navigation}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={finishNavigation}
        open={isSearchOpen}
      />
    </div>
  );
}

function SearchTrigger({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      aria-haspopup="dialog"
      className="mx-auto flex h-10 w-full max-w-xl items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground shadow-xs outline-none transition hover:border-primary/35 hover:text-foreground focus-visible:ring-3 focus-visible:ring-primary/15 lg:mx-0"
      onClick={onClick}
      type="button"
    >
      <Search aria-hidden="true" className="size-4" />
      <span className="truncate">جست‌وجوی سریع در مدیریت</span>
      <kbd className="ms-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[0.65rem] sm:inline">
        Ctrl K
      </kbd>
    </button>
  );
}

function SearchDialog({
  navigation,
  onClose,
  onNavigate,
  open,
}: {
  readonly navigation: readonly AdminNavigationGroup[];
  readonly onClose: () => void;
  readonly onNavigate: () => void;
  readonly open: boolean;
}) {
  const [query, setQuery] = useState('');
  const items = navigation
    .flatMap((group) => group.items)
    .filter((item) => item.label.includes(query.trim()));

  const close = () => {
    setQuery('');
    onClose();
  };
  const navigate = () => {
    setQuery('');
    onNavigate();
  };

  return (
    <ModalLayer
      className="mt-[8vh] max-w-2xl"
      onClose={close}
      open={open}
      title="جست‌وجوی سریع"
    >
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Search aria-hidden="true" className="size-5 text-muted-foreground" />
        <Input
          aria-label="جست‌وجو در بخش‌های مدیریت"
          autoFocus
          className="border-0 shadow-none focus-visible:ring-0"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="نام یک بخش را وارد کنید…"
          value={query}
        />
        <Button aria-label="بستن جست‌وجو" onClick={close} size="icon" variant="ghost">
          <X />
        </Button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
          بخش‌های در دسترس
        </p>
        {items.length ? (
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={navigate}
                    to={item.path}
                  >
                    <Icon aria-hidden="true" className="size-4 text-primary" />
                    {item.label}
                    <ChevronLeft aria-hidden="true" className="ms-auto size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            بخشی با این نام پیدا نشد.
          </p>
        )}
        <p className="mt-2 border-t border-border px-3 py-3 text-xs leading-5 text-muted-foreground">
          جست‌وجوی کالا، کد کالا و سفارش پس از اضافه‌شدن قرارداد جست‌وجوی سراسری فعال می‌شود.
        </p>
      </div>
    </ModalLayer>
  );
}

function ShellBrand({
  collapsed,
  onToggle,
  productName,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly productName: string;
}) {
  return (
    <div className="flex min-h-20 items-center gap-3 border-b border-border px-4">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm"
      >
        B
      </span>
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight" dir="ltr">
            {productName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">مدیریت فروشگاه</p>
        </div>
      ) : null}
      <Button
        aria-label={collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'}
        className={cn(collapsed && 'mx-auto')}
        onClick={onToggle}
        size="icon"
        title={collapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'}
        variant="ghost"
      >
        {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
      </Button>
    </div>
  );
}

function ShellNavigation({
  activePath,
  collapsed,
  navigation,
  onNavigate,
}: {
  readonly activePath: string;
  readonly collapsed: boolean;
  readonly navigation: readonly AdminNavigationGroup[];
  readonly onNavigate: () => void;
}) {
  const groupHeadingPrefix = useId();
  return (
    <nav aria-label="ناوبری مدیریت" className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-5">
        {navigation.map((group, groupIndex) => {
          const headingId = `${groupHeadingPrefix}-${groupIndex}`;
          return (
            <section aria-labelledby={headingId} key={group.label}>
              <h2
                className={cn(
                  'px-3 text-xs font-medium text-muted-foreground',
                  collapsed && 'sr-only',
                )}
                id={headingId}
              >
                {group.label}
              </h2>
              <ul className={cn('space-y-1', !collapsed && 'mt-2')}>
                {group.items.map((item) => {
                  const isActive = navigationIsActive(item, activePath);
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <Link
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                          collapsed && 'justify-center px-0',
                        )}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        to={item.path}
                      >
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                        <span className={cn('min-w-0 flex-1 truncate', collapsed && 'sr-only')}>
                          {item.label}
                        </span>
                        {isActive && !collapsed ? (
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

function StaffPanel({
  collapsed,
  logoutAction,
  staff,
}: {
  readonly collapsed: boolean;
  readonly logoutAction: ReactNode;
  readonly staff: AdminStaffSummary;
}) {
  return (
    <section aria-label="کاربر واردشده" className="border-t border-border px-4 py-4">
      <div className={cn('flex items-start gap-3', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" dir="ltr">
              {staff.email}
            </p>
            {staff.profileSummary ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {staff.profileSummary}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="shrink-0">{logoutAction}</div>
      </div>
    </section>
  );
}
