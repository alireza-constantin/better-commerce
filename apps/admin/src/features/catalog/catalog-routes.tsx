import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, ChevronLeft, ChevronRight, FilePenLine, PackagePlus,
  RefreshCw, RotateCcw, Save, Send, Undo2,
} from 'lucide-react';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import './catalog.css';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { isAdminApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import {
  adminCatalogQueryKeys,
  adminProductDetailQueryOptions,
  adminProductsListQueryOptions,
  createAdminProductMutationOptions,
  replaceProductConfigurationMutationOptions,
  transitionAdminProductMutationOptions,
  updateAdminProductMutationOptions,
  type AdminProduct,
  type AdminProductSummary,
  type ProductConfigurationInput,
} from './api';

const PAGE_LIMIT = 25;
const catalogRouteApi = getRouteApi('/catalog');

/** Lazy-route-ready Catalog entry point. Its query state remains shareable in
 * the URL even before the application adds dedicated nested Catalog routes. */
export function CatalogRoute() {
  return (
    <PermissionBoundary required={adminRoutes.catalog.permissions}>
      <CatalogContent />
    </PermissionBoundary>
  );
}

/** Exported for the later `/catalog/$productId` lazy route. */
export function CatalogProductRoute({ onBack, productId }: { readonly onBack: () => void; readonly productId: string }) {
  return <CatalogProductContent productId={productId} onBack={onBack} />;
}

function CatalogContent() {
  const search = catalogRouteApi.useSearch();
  const navigate = catalogRouteApi.useNavigate();
  const setSearch = (next: Partial<CatalogSearch>) => {
    void navigate({
      to: adminRoutes.catalog.path,
      search: (current) => ({ ...current, ...next }),
    });
  };
  if (search.product) return <CatalogProductRoute onBack={() => setSearch({ product: undefined })} productId={search.product} />;
  if (search.create) return <CreateProductScreen onBack={() => setSearch({ create: undefined })} onCreated={(productId) => setSearch({ create: undefined, product: productId })} />;
  return <ProductsListScreen key={`${search.q ?? ''}:${search.sku ?? ''}:${search.status ?? ''}`} onSearchChange={setSearch} search={search} />;
}

type CatalogSearch = {
  readonly cursor?: string;
  readonly history?: readonly string[];
  readonly q?: string;
  readonly sku?: string;
  readonly status?: 'draft' | 'published' | 'archived';
  readonly product?: string;
  readonly create?: boolean;
};

function ProductsListScreen({ onSearchChange, search }: { readonly onSearchChange: (next: Partial<CatalogSearch>) => void; readonly search: CatalogSearch }) {
  const profile = useAdminSession();
  const products = useQuery(adminProductsListQueryOptions({ cursor: search.cursor, limit: PAGE_LIMIT, q: search.q, sku: search.sku, status: search.status }));
  const [filters, setFilters] = useState({ q: search.q ?? '', sku: search.sku ?? '', status: search.status ?? '' });

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchChange({ q: filters.q.trim() || undefined, sku: filters.sku.trim() || undefined, status: filters.status as CatalogSearch['status'], cursor: undefined, history: [] });
  };
  const goToCursor = (cursor: string | undefined, history: readonly string[]) => onSearchChange({ cursor, history });

  return <section aria-labelledby="catalog-heading" className="space-y-5" dir="rtl">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-[-0.025em]" id="catalog-heading">کالاها</h1><p className="mt-1 text-sm text-muted-foreground">محصولات و گونه‌های قابل فروش فروشگاه را مدیریت کنید.</p></div>
      {hasPermission(profile.permissions, 'catalog.products.write') ? <Button onClick={() => onSearchChange({ create: true, product: undefined })}><PackagePlus aria-hidden="true" /> افزودن کالا</Button> : null}
    </header>
    <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto]" onSubmit={applyFilters}>
      <Field label="جست‌وجو در نام یا نامک"><input className="catalog-input" onChange={(e) => setFilters((v) => ({ ...v, q: e.target.value }))} value={filters.q} /></Field>
      <Field label="کد کالا (SKU)"><input className="catalog-input" dir="ltr" onChange={(e) => setFilters((v) => ({ ...v, sku: e.target.value }))} value={filters.sku} /></Field>
      <Field label="وضعیت"><select className="catalog-input" onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))} value={filters.status}><option value="">همه وضعیت‌ها</option><option value="draft">پیش‌نویس</option><option value="published">منتشرشده</option><option value="archived">بایگانی‌شده</option></select></Field>
      <div className="flex items-end"><Button className="w-full" type="submit" variant="outline">اعمال فیلتر</Button></div>
    </form>
    {products.isPending ? <CatalogSkeleton /> : products.isError ? <CatalogProblem error={products.error} onRetry={() => void products.refetch()} /> : products.data.items.length === 0 ? <CatalogEmpty /> : <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-180 text-right text-sm"><thead className="border-b border-border bg-muted/45 text-xs font-medium text-muted-foreground"><tr><th className="px-4 py-3 font-medium">نام کالا</th><th className="px-4 py-3 font-medium">نامک</th><th className="px-4 py-3 font-medium">وضعیت</th><th className="px-4 py-3 font-medium">آخرین تغییر</th><th className="px-4 py-3"><span className="sr-only">جزئیات</span></th></tr></thead><tbody className="divide-y divide-border">{products.data.items.map((product) => <ProductRow key={product.id} onSelect={() => onSearchChange({ product: product.id, create: undefined })} product={product} />)}</tbody></table></div>
      <nav aria-label="صفحه‌بندی کالاها" className="flex items-center justify-between gap-3"><Button disabled={(search.history?.length ?? 0) === 0 || products.isFetching} onClick={() => { const history = [...(search.history ?? [])]; const previous = history.pop(); goToCursor(previous || undefined, history); }} variant="outline"><ChevronRight aria-hidden="true" /> صفحه پیشین</Button><Button disabled={!products.data.nextCursor || products.isFetching} onClick={() => goToCursor(products.data?.nextCursor ?? undefined, [...(search.history ?? []), search.cursor ?? ''])} variant="outline">صفحه بعد <ChevronLeft aria-hidden="true" /></Button></nav>
    </>}
  </section>;
}

function ProductRow({ onSelect, product }: { readonly onSelect: () => void; readonly product: AdminProductSummary }) {
  return <tr className="transition-colors hover:bg-muted/40"><td className="px-4 py-3 font-medium">{product.title}<p className="mt-1 text-xs font-normal text-muted-foreground">نسخه {product.version.toLocaleString('fa-IR')}</p></td><td className="px-4 py-3 text-muted-foreground"><bdi dir="ltr">{product.slug}</bdi></td><td className="px-4 py-3"><ProductStatus status={product.status} /></td><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(product.updatedAt)}</td><td className="px-4 py-3 text-left"><Button aria-label={`مشاهده ${product.title}`} onClick={onSelect} size="sm" variant="ghost">جزئیات <ChevronLeft aria-hidden="true" /></Button></td></tr>;
}

function CreateProductScreen({ onBack, onCreated }: { readonly onBack: () => void; readonly onCreated: (productId: string) => void }) {
  const queryClient = useQueryClient();
  const create = useMutation(createAdminProductMutationOptions());
  useEffect(() => {
    if (isConflict(create.error)) {
      void queryClient.invalidateQueries({ queryKey: adminCatalogQueryKeys.lists() });
    }
  }, [create.error, queryClient]);
  return <section className="mx-auto max-w-3xl space-y-5" dir="rtl"><header><Button onClick={onBack} size="sm" variant="ghost">بازگشت به کالاها</Button><h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">افزودن کالا</h1><p className="mt-1 text-sm text-muted-foreground">کالا ابتدا به‌صورت پیش‌نویس ایجاد می‌شود.</p></header>{create.error ? <CatalogProblem error={create.error} /> : null}<ProductEditor submitLabel="ایجاد کالا" isSubmitting={create.isPending} onSubmit={async (input) => { const created = await create.mutateAsync(toCreateProductInput(input)); await queryClient.invalidateQueries({ queryKey: adminCatalogQueryKeys.lists() }); onCreated(created.productId); }} /></section>;
}

function CatalogProductContent({ onBack, productId }: { readonly onBack: () => void; readonly productId: string }) {
  const profile = useAdminSession();
  const queryClient = useQueryClient();
  const product = useQuery(adminProductDetailQueryOptions(productId));
  const update = useMutation(updateAdminProductMutationOptions());
  const configure = useMutation(replaceProductConfigurationMutationOptions());
  const transition = useMutation(transitionAdminProductMutationOptions());
  const error = product.error ?? update.error ?? configure.error ?? transition.error;
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: adminCatalogQueryKeys.detail(productId) }), queryClient.invalidateQueries({ queryKey: adminCatalogQueryKeys.lists() })]); };
  useEffect(() => {
    if (isConflict(error)) {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: adminCatalogQueryKeys.detail(productId) }),
        queryClient.invalidateQueries({ queryKey: adminCatalogQueryKeys.lists() }),
      ]);
    }
  }, [error, productId, queryClient]);
  if (product.isPending) return <CatalogSkeleton />;
  if (product.isError) return <CatalogProblem error={error} onRetry={() => void product.refetch()} />;
  const canWrite = hasPermission(profile.permissions, 'catalog.products.write');
  const canPublish = hasPermission(profile.permissions, 'catalog.products.publish');
  const canArchive = hasPermission(profile.permissions, 'catalog.products.archive');
  const isSubmitting = update.isPending || configure.isPending || transition.isPending;
  return <article className="mx-auto max-w-5xl space-y-6" dir="rtl"><header className="flex flex-wrap items-start justify-between gap-4"><div><Button onClick={onBack} size="sm" variant="ghost">بازگشت به کالاها</Button><div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-[-0.025em]">{product.data.title}</h1><ProductStatus status={product.data.status} /></div><p className="mt-2 text-sm text-muted-foreground">نامک: <bdi dir="ltr">{product.data.slug}</bdi> · نسخه {product.data.version.toLocaleString('fa-IR')}</p></div><LifecycleActions canArchive={canArchive} canPublish={canPublish} isSubmitting={isSubmitting} onTransition={async (action) => { if (!confirmTransition(action, product.data.title)) return; await transition.mutateAsync({ action, expectedVersion: product.data.version, productId }); await refresh(); }} product={product.data} /></header>
    {error ? <CatalogProblem error={error} /> : null}
    {canWrite ? <ProductEditor initial={product.data} isSubmitting={isSubmitting} key={`product-${product.data.version}`} submitLabel="ذخیره تغییرات" onSubmit={async (input) => { await update.mutateAsync({ productId, input: { description: nullableText(input.description), expectedVersion: product.data.version, slug: input.slug, summary: nullableText(input.summary), title: input.title } }); await refresh(); }} /> : <ProductReadOnly product={product.data} />}
    {canWrite ? <ConfigurationEditor isSubmitting={isSubmitting} key={`configuration-${product.data.version}`} onSubmit={async (input) => { await configure.mutateAsync({ productId, input: { ...input, expectedVersion: product.data.version } }); await refresh(); }} product={product.data} /> : <ConfigurationReadOnly product={product.data} />}
  </article>;
}

type ProductFormValue = { readonly title: string; readonly slug: string; readonly summary: string; readonly description: string; readonly defaultVariantTitle: string; readonly defaultVariantSku: string; readonly fulfillmentClassification: 'physical' | 'digital' | 'service' };

function ProductEditor({ initial, isSubmitting, onSubmit, submitLabel }: { readonly initial?: AdminProduct; readonly isSubmitting: boolean; readonly onSubmit: (input: ProductFormValue) => Promise<void>; readonly submitLabel: string }) {
  const [value, setValue] = useState<ProductFormValue>(() => ({ title: initial?.title ?? '', slug: initial?.slug ?? '', summary: initial?.summary ?? '', description: initial?.description ?? '', defaultVariantTitle: initial?.variants[0]?.title ?? '', defaultVariantSku: initial?.variants[0]?.sku ?? '', fulfillmentClassification: initial?.variants[0]?.fulfillmentClassification ?? 'physical' }));
  const set = <K extends keyof ProductFormValue>(key: K, next: ProductFormValue[K]) => setValue((current) => ({ ...current, [key]: next }));
  return <form className="space-y-5 rounded-lg border border-border bg-card p-5" onSubmit={(event) => { event.preventDefault(); void onSubmit(value).catch(() => undefined); }}><div><h2 className="font-semibold">اطلاعات کالا</h2><p className="mt-1 text-sm text-muted-foreground">فقط داده‌های نمایش محصول در این بخش ذخیره می‌شوند.</p></div><div className="grid gap-4 md:grid-cols-2"><Field label="نام کالا"><input className="catalog-input" onChange={(e) => set('title', e.target.value)} required value={value.title} /></Field><Field label="نامک"><input className="catalog-input" dir="ltr" onChange={(e) => set('slug', e.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value={value.slug} /><p className="catalog-help">حروف کوچک انگلیسی، عدد و خط تیره</p></Field><Field label="خلاصه"><input className="catalog-input" onChange={(e) => set('summary', e.target.value)} value={value.summary} /></Field>{!initial ? <Field label="نوع تأمین"><select className="catalog-input" onChange={(e) => set('fulfillmentClassification', e.target.value as ProductFormValue['fulfillmentClassification'])} value={value.fulfillmentClassification}><option value="physical">فیزیکی</option><option value="digital">دیجیتال</option><option value="service">خدمات</option></select></Field> : null}</div><Field label="توضیحات"><textarea className="catalog-input min-h-28 py-2" onChange={(e) => set('description', e.target.value)} value={value.description} /></Field>{!initial ? <div className="border-t border-border pt-5"><h3 className="text-sm font-semibold">گونه پیش‌فرض</h3><div className="mt-3 grid gap-4 md:grid-cols-2"><Field label="عنوان گونه"><input className="catalog-input" onChange={(e) => set('defaultVariantTitle', e.target.value)} value={value.defaultVariantTitle} /></Field><Field label="کد کالا"><input className="catalog-input" dir="ltr" onChange={(e) => set('defaultVariantSku', e.target.value)} value={value.defaultVariantSku} /></Field></div></div> : null}<div className="flex justify-end"><Button disabled={isSubmitting} type="submit"><Save aria-hidden="true" /> {isSubmitting ? 'در حال ذخیره…' : submitLabel}</Button></div></form>;
}

function ProductReadOnly({ product }: { readonly product: AdminProduct }) { return <section className="rounded-lg border border-border bg-card p-5"><h2 className="font-semibold">اطلاعات کالا</h2><dl className="mt-4 grid gap-4 text-sm md:grid-cols-2"><Definition label="نام کالا" value={product.title} /><Definition label="نامک" value={product.slug} ltr /><Definition label="خلاصه" value={product.summary ?? '—'} /><Definition label="آخرین تغییر" value={formatDate(product.updatedAt)} /></dl>{product.description ? <p className="mt-5 whitespace-pre-wrap border-t border-border pt-5 text-sm leading-7 text-muted-foreground">{product.description}</p> : null}</section>; }

function ConfigurationEditor({ isSubmitting, onSubmit, product }: { readonly isSubmitting: boolean; readonly onSubmit: (input: ProductConfigurationInput) => Promise<void>; readonly product: AdminProduct }) {
  const initial = JSON.stringify({ options: product.options, variants: product.variants.map(({ fulfillmentClassification, id, position, selectionValueIds, sku, status, title }) => ({ fulfillmentClassification, id, position, selectionValueIds, sku, status, title })) }, null, 2);
  const [text, setText] = useState(initial); const [validation, setValidation] = useState<string>();
  return <form className="rounded-lg border border-border bg-card p-5" onSubmit={(event) => { event.preventDefault(); try { const parsed: unknown = JSON.parse(text); if (!isConfigurationPayload(parsed)) throw new Error('ساختار باید شامل گزینه‌ها و گونه‌ها باشد.'); setValidation(undefined); void onSubmit({ ...parsed, expectedVersion: product.version }).catch(() => undefined); } catch (error) { setValidation(error instanceof Error ? error.message : 'پیکربندی معتبر نیست.'); } }}><h2 className="font-semibold">پیکربندی گونه‌ها</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">این عملیات کل گزینه‌ها و گونه‌ها را به‌صورت یکجا جایگزین می‌کند. شناسه‌های موجود را برای حفظ همان گزینه یا گونه نگه دارید.</p><label className="mt-4 block text-sm font-medium">پیکربندی JSON<textarea aria-describedby="configuration-help" className="catalog-input min-h-96 resize-y py-3 font-mono text-xs leading-6" dir="ltr" onChange={(e) => setText(e.target.value)} spellCheck={false} value={text} /></label><p className="catalog-help" id="configuration-help">پیش از ذخیره، ساختار در مرورگر بررسی می‌شود؛ اعتبار نهایی با سرویس است.</p>{validation ? <p className="mt-3 text-sm text-destructive" role="alert">{validation}</p> : null}<div className="mt-4 flex justify-end"><Button disabled={isSubmitting} type="submit"><FilePenLine aria-hidden="true" /> {isSubmitting ? 'در حال ذخیره…' : 'جایگزینی پیکربندی'}</Button></div></form>;
}

function ConfigurationReadOnly({ product }: { readonly product: AdminProduct }) { return <section className="rounded-lg border border-border bg-card p-5"><h2 className="font-semibold">گونه‌ها و گزینه‌ها</h2><div className="mt-4 space-y-3">{product.options.map((option) => <div className="rounded-md bg-muted/55 p-3" key={option.id}><p className="font-medium">{option.name}</p><p className="mt-1 text-sm text-muted-foreground">{option.values.map((value) => value.label).join('، ') || 'بدون مقدار'}</p></div>)}{product.variants.map((variant) => <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm" key={variant.id}><span>{variant.title ?? 'گونه بدون عنوان'} · {fulfillmentLabel(variant.fulfillmentClassification)}</span><span><bdi dir="ltr">{variant.sku ?? '—'}</bdi> · {variant.status === 'active' ? 'فعال' : 'بایگانی‌شده'}</span></div>)}</div></section>; }

function LifecycleActions({ canArchive, canPublish, isSubmitting, onTransition, product }: { readonly canArchive: boolean; readonly canPublish: boolean; readonly isSubmitting: boolean; readonly onTransition: (action: 'publish' | 'unpublish' | 'archive' | 'restore') => Promise<void>; readonly product: AdminProduct }) {
  const actions = product.status === 'draft' ? (canPublish ? [{ action: 'publish' as const, label: 'انتشار', icon: Send }] : []) : product.status === 'published' ? [{ action: 'unpublish' as const, label: 'بازگرداندن به پیش‌نویس', icon: Undo2 }, ...(canArchive ? [{ action: 'archive' as const, label: 'بایگانی', icon: Archive }] : [])] : (canArchive ? [{ action: 'restore' as const, label: 'بازیابی به پیش‌نویس', icon: RotateCcw }] : []);
  return <div className="flex flex-wrap gap-2">{actions.map(({ action, icon: Icon, label }) => <Button className={action === 'archive' ? 'text-destructive hover:text-destructive' : undefined} disabled={isSubmitting} key={action} onClick={() => void onTransition(action).catch(() => undefined)} size="sm" variant="outline"><Icon aria-hidden="true" /> {label}</Button>)}</div>;
}

function CatalogProblem({ error, onRetry }: { readonly error: unknown; readonly onRetry?: () => void }) { return <section className="rounded-lg border border-destructive/25 bg-card px-5 py-6" dir="rtl" role="alert"><h2 className="font-semibold">دریافت یا ذخیره کالا انجام نشد</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{catalogErrorMessage(error)}</p>{onRetry ? <Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button> : null}</section>; }
function CatalogEmpty() { return <section className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center" dir="rtl"><PackagePlus aria-hidden="true" className="size-8 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">کالایی پیدا نشد</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">فیلترها را تغییر دهید یا اولین کالای فروشگاه را ایجاد کنید.</p></section>; }
function CatalogSkeleton() { return <section aria-busy="true" aria-label="در حال دریافت کالاها" className="space-y-4" dir="rtl"><div className="h-8 w-28 animate-pulse rounded bg-muted" /><div className="h-16 animate-pulse rounded-lg bg-muted" />{Array.from({ length: 5 }, (_, index) => <div className="h-16 animate-pulse rounded-lg bg-muted" key={index} />)}</section>; }
function Field({ children, label }: { readonly children: React.ReactNode; readonly label: string }) { return <label className="block text-sm font-medium">{label}{children}</label>; }
function Definition({ label, ltr, value }: { readonly label: string; readonly value: string; readonly ltr?: boolean }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd></div>; }
function ProductStatus({ status }: { readonly status: AdminProduct['status'] }) { const tone = status === 'published' ? 'bg-emerald-700/10 text-emerald-800' : status === 'archived' ? 'bg-destructive/10 text-destructive' : 'bg-amber-700/10 text-amber-900'; const label = status === 'published' ? 'منتشرشده' : status === 'archived' ? 'بایگانی‌شده' : 'پیش‌نویس'; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function fulfillmentLabel(value: 'physical' | 'digital' | 'service') { return value === 'physical' ? 'فیزیکی' : value === 'digital' ? 'دیجیتال' : 'خدمات'; }
function nullableText(value: string) { return (value.trim() || null) as never; }
function toCreateProductInput(value: ProductFormValue) { return { defaultVariantSku: nullableText(value.defaultVariantSku), defaultVariantTitle: nullableText(value.defaultVariantTitle), description: nullableText(value.description), fulfillmentClassification: value.fulfillmentClassification, slug: value.slug, summary: nullableText(value.summary), title: value.title }; }
function confirmTransition(action: 'publish' | 'unpublish' | 'archive' | 'restore', title: string) { const message = action === 'publish' ? `«${title}» منتشر شود؟` : action === 'unpublish' ? `«${title}» به پیش‌نویس برگردد؟` : action === 'archive' ? `«${title}» بایگانی شود؟` : `«${title}» به پیش‌نویس بازیابی شود؟`; return window.confirm(message); }
function catalogErrorMessage(error: unknown) { if (isAdminApiError(error) && error.problem.kind === 'api') { if (error.problem.status === 403) return 'حساب شما اجازه انجام این عملیات را ندارد.'; if (error.problem.status === 404) return 'کالای موردنظر پیدا نشد یا دیگر در دسترس نیست.'; if (error.problem.status === 409) return 'کالا هم‌زمان تغییر کرده است. اطلاعات را تازه‌سازی و دوباره بررسی کنید.'; if (error.problem.status === 400) return 'اطلاعات کالا یا پیکربندی آن معتبر نیست.'; } return 'پاسخ معتبری از سرویس کالاها دریافت نشد. دوباره تلاش کنید.'; }
function isConflict(error: unknown) { return isAdminApiError(error) && error.problem.kind === 'api' && error.problem.status === 409; }
function isConfigurationPayload(value: unknown): value is Omit<ProductConfigurationInput, 'expectedVersion'> { return Boolean(value && typeof value === 'object' && Array.isArray((value as { options?: unknown }).options) && Array.isArray((value as { variants?: unknown }).variants)); }
