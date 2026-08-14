import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  ImagePlus,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
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
  uploadProductMediaMutationOptions,
  replaceProductMediaMutationOptions,
  removeProductMediaMutationOptions,
  type AdminProduct,
  type AdminProductSummary,
  type ProductConfigurationInput,
} from './api';
import { listCurrentPrices } from '@/features/pricing/api/pricing-api';
import {
  listCurrentInventory,
  type CurrentInventory,
} from '@/features/inventory/api/inventory-api';
import { commerceAuditListQueryOptions } from '@/features/commerce-audit/api/commerce-audit-query';
import { CommerceAuditEvents } from '@/features/commerce-audit/components';
import {
  categoriesQuery,
  productCategoriesMutation,
} from './api/catalog-navigation-query';

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
export function CatalogProductRoute({
  onBack,
  productId,
}: {
  readonly onBack: () => void;
  readonly productId: string;
}) {
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
  if (search.product)
    return (
      <CatalogProductRoute
        onBack={() => setSearch({ product: undefined })}
        productId={search.product}
      />
    );
  if (search.create)
    return (
      <CreateProductScreen
        onBack={() => setSearch({ create: undefined })}
        onCreated={(productId) =>
          setSearch({ create: undefined, product: productId })
        }
      />
    );
  return (
    <ProductsListScreen
      key={`${search.q ?? ''}:${search.sku ?? ''}:${search.status ?? ''}`}
      onSearchChange={setSearch}
      search={search}
    />
  );
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

function ProductsListScreen({
  onSearchChange,
  search,
}: {
  readonly onSearchChange: (next: Partial<CatalogSearch>) => void;
  readonly search: CatalogSearch;
}) {
  const profile = useAdminSession();
  const products = useQuery(
    adminProductsListQueryOptions({
      cursor: search.cursor,
      limit: PAGE_LIMIT,
      q: search.q,
      sku: search.sku,
      status: search.status,
    }),
  );
  const [filters, setFilters] = useState({
    q: search.q ?? '',
    sku: search.sku ?? '',
    status: search.status ?? '',
  });

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchChange({
      q: filters.q.trim() || undefined,
      sku: filters.sku.trim() || undefined,
      status: filters.status as CatalogSearch['status'],
      cursor: undefined,
      history: [],
    });
  };
  const goToCursor = (cursor: string | undefined, history: readonly string[]) =>
    onSearchChange({ cursor, history });

  return (
    <section aria-labelledby="catalog-heading" className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold tracking-[-0.025em]"
            id="catalog-heading"
          >
            کالاها
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            محصولات و گونه‌های قابل فروش فروشگاه را مدیریت کنید.
          </p>
        </div>
        {hasPermission(profile.permissions, 'catalog.products.write') ? (
          <Button
            onClick={() => onSearchChange({ create: true, product: undefined })}
          >
            <PackagePlus aria-hidden="true" /> افزودن کالا
          </Button>
        ) : null}
      </header>
      <form
        className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto]"
        onSubmit={applyFilters}
      >
        <Field label="جست‌وجو در نام یا نامک">
          <input
            className="catalog-input"
            onChange={(e) => setFilters((v) => ({ ...v, q: e.target.value }))}
            value={filters.q}
          />
        </Field>
        <Field label="کد کالا (SKU)">
          <input
            className="catalog-input"
            dir="ltr"
            onChange={(e) => setFilters((v) => ({ ...v, sku: e.target.value }))}
            value={filters.sku}
          />
        </Field>
        <Field label="وضعیت">
          <select
            className="catalog-input"
            onChange={(e) =>
              setFilters((v) => ({ ...v, status: e.target.value }))
            }
            value={filters.status}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">بایگانی‌شده</option>
          </select>
        </Field>
        <div className="flex items-end">
          <Button className="w-full" type="submit" variant="outline">
            اعمال فیلتر
          </Button>
        </div>
      </form>
      {products.isPending ? (
        <CatalogSkeleton />
      ) : products.isError ? (
        <CatalogProblem
          error={products.error}
          onRetry={() => void products.refetch()}
        />
      ) : products.data.items.length === 0 ? (
        <CatalogEmpty />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-180 text-right text-sm">
              <thead className="border-b border-border bg-muted/45 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">نام کالا</th>
                  <th className="px-4 py-3 font-medium">نامک</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium">آخرین تغییر</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">جزئیات</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.data.items.map((product) => (
                  <ProductRow
                    key={product.id}
                    onSelect={() =>
                      onSearchChange({ product: product.id, create: undefined })
                    }
                    product={product}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <nav
            aria-label="صفحه‌بندی کالاها"
            className="flex items-center justify-between gap-3"
          >
            <Button
              disabled={
                (search.history?.length ?? 0) === 0 || products.isFetching
              }
              onClick={() => {
                const history = [...(search.history ?? [])];
                const previous = history.pop();
                goToCursor(previous || undefined, history);
              }}
              variant="outline"
            >
              <ChevronRight aria-hidden="true" /> صفحه پیشین
            </Button>
            <Button
              disabled={!products.data.nextCursor || products.isFetching}
              onClick={() =>
                goToCursor(products.data?.nextCursor ?? undefined, [
                  ...(search.history ?? []),
                  search.cursor ?? '',
                ])
              }
              variant="outline"
            >
              صفحه بعد <ChevronLeft aria-hidden="true" />
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}

function ProductRow({
  onSelect,
  product,
}: {
  readonly onSelect: () => void;
  readonly product: AdminProductSummary;
}) {
  return (
    <tr className="transition-colors hover:bg-muted/40">
      <td className="px-4 py-3 font-medium">
        {product.title}
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          نسخه {product.version.toLocaleString('fa-IR')}
        </p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        <bdi dir="ltr">{product.slug}</bdi>
      </td>
      <td className="px-4 py-3">
        <ProductStatus status={product.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatDate(product.updatedAt)}
      </td>
      <td className="px-4 py-3 text-left">
        <Button
          aria-label={`مشاهده ${product.title}`}
          onClick={onSelect}
          size="sm"
          variant="ghost"
        >
          جزئیات <ChevronLeft aria-hidden="true" />
        </Button>
      </td>
    </tr>
  );
}

function CreateProductScreen({
  onBack,
  onCreated,
}: {
  readonly onBack: () => void;
  readonly onCreated: (productId: string) => void;
}) {
  const queryClient = useQueryClient();
  const create = useMutation(createAdminProductMutationOptions());
  useEffect(() => {
    if (isConflict(create.error)) {
      void queryClient.invalidateQueries({
        queryKey: adminCatalogQueryKeys.lists(),
      });
    }
  }, [create.error, queryClient]);
  return (
    <section className="mx-auto max-w-3xl space-y-5" dir="rtl">
      <header>
        <Button onClick={onBack} size="sm" variant="ghost">
          بازگشت به کالاها
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">
          افزودن کالا
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          کالا ابتدا به‌صورت پیش‌نویس ایجاد می‌شود.
        </p>
      </header>
      {create.error ? <CatalogProblem error={create.error} /> : null}
      <ProductEditor
        submitLabel="ایجاد کالا"
        isSubmitting={create.isPending}
        onSubmit={async (input) => {
          const created = await create.mutateAsync(toCreateProductInput(input));
          await queryClient.invalidateQueries({
            queryKey: adminCatalogQueryKeys.lists(),
          });
          onCreated(created.productId);
        }}
      />
    </section>
  );
}

function CatalogProductContent({
  onBack,
  productId,
}: {
  readonly onBack: () => void;
  readonly productId: string;
}) {
  const profile = useAdminSession();
  const queryClient = useQueryClient();
  const product = useQuery(adminProductDetailQueryOptions(productId));
  const update = useMutation(updateAdminProductMutationOptions());
  const configure = useMutation(replaceProductConfigurationMutationOptions());
  const replaceCategories = useMutation(productCategoriesMutation());
  const transition = useMutation(transitionAdminProductMutationOptions());
  const canReadCategories = hasPermission(
    profile.permissions,
    'catalog.categories.read',
  );
  const canReadActivity = hasPermission(profile.permissions, 'audit.read');
  const activity = useQuery({
    ...commerceAuditListQueryOptions({ productId }),
    enabled: canReadActivity,
  });
  const categories = useQuery({
    ...categoriesQuery(),
    enabled: canReadCategories,
  });
  const error =
    product.error ??
    update.error ??
    configure.error ??
    replaceCategories.error ??
    transition.error;
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminCatalogQueryKeys.detail(productId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminCatalogQueryKeys.lists(),
      }),
    ]);
  };
  useEffect(() => {
    if (isConflict(error)) {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminCatalogQueryKeys.detail(productId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminCatalogQueryKeys.lists(),
        }),
      ]);
    }
  }, [error, productId, queryClient]);
  if (product.isPending) return <CatalogSkeleton />;
  if (product.isError)
    return (
      <CatalogProblem error={error} onRetry={() => void product.refetch()} />
    );
  const canWrite = hasPermission(profile.permissions, 'catalog.products.write');
  const canPublish = hasPermission(
    profile.permissions,
    'catalog.products.publish',
  );
  const canArchive = hasPermission(
    profile.permissions,
    'catalog.products.archive',
  );
  const isSubmitting =
    update.isPending ||
    configure.isPending ||
    replaceCategories.isPending ||
    transition.isPending;
  return (
    <article className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button onClick={onBack} size="sm" variant="ghost">
            بازگشت به کالاها
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">
              {product.data.title}
            </h1>
            <ProductStatus status={product.data.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            نامک: <bdi dir="ltr">{product.data.slug}</bdi> · نسخه{' '}
            {product.data.version.toLocaleString('fa-IR')}
          </p>
        </div>
        <LifecycleActions
          canArchive={canArchive}
          canPublish={canPublish}
          isSubmitting={isSubmitting}
          onTransition={async (action) => {
            if (!confirmTransition(action, product.data.title)) return;
            await transition.mutateAsync({
              action,
              expectedVersion: product.data.version,
              productId,
            });
            await refresh();
          }}
          product={product.data}
        />
      </header>
      {error ? <CatalogProblem error={error} /> : null}
      {canWrite ? (
        <ProductEditor
          initial={product.data}
          isSubmitting={isSubmitting}
          key={`product-${product.data.version}`}
          submitLabel="ذخیره تغییرات"
          onSubmit={async (input) => {
            await update.mutateAsync({
              productId,
              input: {
                description: nullableText(input.description),
                expectedVersion: product.data.version,
                slug: input.slug,
                summary: nullableText(input.summary),
                title: input.title,
              },
            });
            await refresh();
          }}
        />
      ) : (
        <ProductReadOnly product={product.data} />
      )}
      {canWrite && canReadCategories && categories.data ? (
        <ProductCategoryEditor
          categories={categories.data.items}
          isSubmitting={isSubmitting}
          key={`categories-${product.data.version}`}
          onSubmit={async (categoryIds) => {
            await replaceCategories.mutateAsync({
              categoryIds,
              expectedVersion: product.data.version,
              id: productId,
            });
            await refresh();
          }}
          product={product.data}
        />
      ) : null}
      <ProductMediaEditor
        canWrite={canWrite}
        onChanged={refresh}
        product={product.data}
      />
      {canWrite ? (
        <VisualConfigurationEditor
          canReadInventory={hasPermission(
            profile.permissions,
            'inventory.read',
          )}
          canReadPricing={hasPermission(profile.permissions, 'pricing.read')}
          canWriteInventory={hasPermission(
            profile.permissions,
            'inventory.adjust',
          )}
          canWritePricing={hasPermission(profile.permissions, 'pricing.write')}
          isSubmitting={isSubmitting}
          key={`configuration-${product.data.version}`}
          onSubmit={async (input) => {
            await configure.mutateAsync({
              productId,
              input: { ...input, expectedVersion: product.data.version },
            });
            await refresh();
          }}
          product={product.data}
        />
      ) : (
        <ConfigurationReadOnly product={product.data} />
      )}
      {canReadActivity ? (
        <CommerceAuditEvents
          description="تغییرات محصول، واریانت، قیمت و موجودی به‌صورت یکپارچه ثبت می‌شوند."
          emptyTitle="هنوز فعالیتی برای این محصول ثبت نشده است"
          error={activity.error instanceof Error ? activity.error.message : undefined}
          heading="فعالیت محصول"
          isFetching={activity.isFetching}
          isLoading={activity.isPending}
          onRetry={() => void activity.refetch()}
          page={activity.data}
        />
      ) : null}
    </article>
  );
}

function ProductCategoryEditor({
  categories,
  isSubmitting,
  onSubmit,
  product,
}: {
  readonly categories: readonly {
    id: string;
    status: 'active' | 'archived';
    title: string;
  }[];
  readonly isSubmitting: boolean;
  readonly onSubmit: (categoryIds: string[]) => Promise<void>;
  readonly product: AdminProduct;
}) {
  const [selected, setSelected] = useState(() => new Set(product.categoryIds));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold">دسته‌بندی‌های کالا</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        دسته‌بندی‌های این کالا را انتخاب کنید. عضویت‌های موجود کامل خوانده
        شده‌اند تا هنگام ذخیره از بین نروند.
      </p>
      {categories.length ? (
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">دسته‌بندی‌های کالا</legend>
          {categories.map((category) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              key={category.id}
            >
              <input
                checked={selected.has(category.id)}
                disabled={isSubmitting}
                onChange={() => toggle(category.id)}
                type="checkbox"
              />
              <span>{category.title}</span>
              {category.status === 'archived' ? (
                <span className="text-xs text-muted-foreground">
                  (بایگانی‌شده)
                </span>
              ) : null}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          هنوز دسته‌بندی‌ای برای انتخاب وجود ندارد.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          disabled={isSubmitting}
          onClick={() => void onSubmit([...selected]).catch(() => undefined)}
        >
          <Save aria-hidden="true" />{' '}
          {isSubmitting ? 'در حال ذخیره…' : 'ذخیره دسته‌بندی‌ها'}
        </Button>
      </div>
    </section>
  );
}

type ProductFormValue = {
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly description: string;
  readonly defaultVariantTitle: string;
  readonly defaultVariantSku: string;
  readonly fulfillmentClassification: 'physical' | 'digital' | 'service';
};

function ProductEditor({
  initial,
  isSubmitting,
  onSubmit,
  submitLabel,
}: {
  readonly initial?: AdminProduct;
  readonly isSubmitting: boolean;
  readonly onSubmit: (input: ProductFormValue) => Promise<void>;
  readonly submitLabel: string;
}) {
  const [value, setValue] = useState<ProductFormValue>(() => ({
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    summary: initial?.summary ?? '',
    description: initial?.description ?? '',
    defaultVariantTitle: initial?.variants[0]?.title ?? '',
    defaultVariantSku: initial?.variants[0]?.sku ?? '',
    fulfillmentClassification:
      initial?.variants[0]?.fulfillmentClassification ?? 'physical',
  }));
  const set = <K extends keyof ProductFormValue>(
    key: K,
    next: ProductFormValue[K],
  ) => setValue((current) => ({ ...current, [key]: next }));
  return (
    <form
      className="space-y-5 rounded-lg border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(value).catch(() => undefined);
      }}
    >
      <div>
        <h2 className="font-semibold">اطلاعات کالا</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          فقط داده‌های نمایش محصول در این بخش ذخیره می‌شوند.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="نام کالا">
          <input
            className="catalog-input"
            onChange={(e) => set('title', e.target.value)}
            required
            value={value.title}
          />
        </Field>
        <Field label="نامک">
          <input
            className="catalog-input"
            dir="ltr"
            onChange={(e) => set('slug', e.target.value)}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
            value={value.slug}
          />
          <p className="catalog-help">حروف کوچک انگلیسی، عدد و خط تیره</p>
        </Field>
        <Field label="خلاصه">
          <input
            className="catalog-input"
            onChange={(e) => set('summary', e.target.value)}
            value={value.summary}
          />
        </Field>
        {!initial ? (
          <Field label="نوع تأمین">
            <select
              className="catalog-input"
              onChange={(e) =>
                set(
                  'fulfillmentClassification',
                  e.target
                    .value as ProductFormValue['fulfillmentClassification'],
                )
              }
              value={value.fulfillmentClassification}
            >
              <option value="physical">فیزیکی</option>
              <option value="digital">دیجیتال</option>
              <option value="service">خدمات</option>
            </select>
          </Field>
        ) : null}
      </div>
      <Field label="توضیحات">
        <textarea
          className="catalog-input min-h-28 py-2"
          onChange={(e) => set('description', e.target.value)}
          value={value.description}
        />
      </Field>
      {!initial ? (
        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-semibold">گونه پیش‌فرض</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="عنوان گونه">
              <input
                className="catalog-input"
                onChange={(e) => set('defaultVariantTitle', e.target.value)}
                value={value.defaultVariantTitle}
              />
            </Field>
            <Field label="کد کالا">
              <input
                className="catalog-input"
                dir="ltr"
                onChange={(e) => set('defaultVariantSku', e.target.value)}
                value={value.defaultVariantSku}
              />
            </Field>
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={isSubmitting} type="submit">
          <Save aria-hidden="true" />{' '}
          {isSubmitting ? 'در حال ذخیره…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function ProductReadOnly({ product }: { readonly product: AdminProduct }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold">اطلاعات کالا</h2>
      <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
        <Definition label="نام کالا" value={product.title} />
        <Definition label="نامک" value={product.slug} ltr />
        <Definition label="خلاصه" value={product.summary ?? '—'} />
        <Definition label="آخرین تغییر" value={formatDate(product.updatedAt)} />
      </dl>
      {product.description ? (
        <p className="mt-5 whitespace-pre-wrap border-t border-border pt-5 text-sm leading-7 text-muted-foreground">
          {product.description}
        </p>
      ) : null}
    </section>
  );
}

function ProductMediaEditor({
  canWrite,
  onChanged,
  product,
}: {
  readonly canWrite: boolean;
  readonly onChanged: () => Promise<void>;
  readonly product: AdminProduct;
}) {
  const upload = useMutation(uploadProductMediaMutationOptions());
  const replace = useMutation(replaceProductMediaMutationOptions());
  const remove = useMutation(removeProductMediaMutationOptions());
  const [items, setItems] = useState(() =>
    product.media.map((item) => ({ ...item })),
  );
  const error = upload.error ?? replace.error ?? remove.error;
  const busy = upload.isPending || replace.isPending || remove.isPending;
  const move = (index: number, direction: -1 | 1) =>
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((item, position) => ({ ...item, position }));
    });
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold">تصاویر کالا</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          تصویر اول، تصویر اصلی کالا است. برای دسترس‌پذیری هر تصویر متن جایگزین
          بنویسید.
        </p>
      </div>
      {error ? <CatalogProblem error={error} /> : null}
      {items.length ? (
        <ol className="catalog-media-grid">
          {items.map((item, index) => (
            <li key={item.id}>
              <img
                alt={item.altText}
                height={item.height}
                loading="lazy"
                src={item.url}
                width={item.width}
              />
              <div className="space-y-2 p-3">
                <Field label="متن جایگزین">
                  <input
                    className="catalog-input"
                    disabled={!canWrite || busy}
                    maxLength={300}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, altText: event.target.value }
                            : entry,
                        ),
                      )
                    }
                    value={item.altText}
                  />
                </Field>
                {canWrite ? (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      aria-label="انتقال تصویر به بالا"
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                      size="sm"
                      variant="outline"
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label="انتقال تصویر به پایین"
                      disabled={busy || index === items.length - 1}
                      onClick={() => move(index, 1)}
                      size="sm"
                      variant="outline"
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      className="text-destructive"
                      disabled={busy}
                      onClick={() =>
                        void remove
                          .mutateAsync({
                            expectedVersion: product.version,
                            mediaId: item.id,
                            productId: product.id,
                          })
                          .then(onChanged)
                          .catch(() => undefined)
                      }
                      size="sm"
                      variant="outline"
                    >
                      <Trash2 aria-hidden="true" /> حذف
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          هنوز تصویری برای این کالا ثبت نشده است.
        </p>
      )}
      {canWrite ? (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-5">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const file = form.get('file');
              const altText = form.get('altText');
              if (!(file instanceof File) || file.size === 0) return;
              void upload
                .mutateAsync({
                  altText: typeof altText === 'string' ? altText : '',
                  expectedVersion: product.version,
                  file,
                  productId: product.id,
                })
                .then(onChanged)
                .catch(() => undefined);
            }}
          >
            <Field label="فایل تصویر">
              <input
                accept="image/jpeg,image/png,image/webp"
                className="catalog-input"
                disabled={busy || items.length >= 20}
                name="file"
                required
                type="file"
              />
            </Field>
            <Field label="متن جایگزین">
              <input className="catalog-input" maxLength={300} name="altText" />
            </Field>
            <Button disabled={busy || items.length >= 20} type="submit">
              <ImagePlus aria-hidden="true" /> بارگذاری تصویر
            </Button>
          </form>
          {items.length ? (
            <Button
              disabled={busy}
              onClick={() =>
                void replace
                  .mutateAsync({
                    input: {
                      expectedVersion: product.version,
                      items: items.map(({ altText, id, position }) => ({
                        altText,
                        id,
                        position,
                      })),
                    },
                    productId: product.id,
                  })
                  .then(onChanged)
                  .catch(() => undefined)
              }
              variant="outline"
            >
              <Save aria-hidden="true" /> ذخیره ترتیب و متن‌ها
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type ConfigurationDraft = {
  options: {
    id: string;
    name: string;
    position: number;
    values: { id: string; label: string; position: number }[];
  }[];
  variants: {
    fulfillmentClassification: 'physical' | 'digital' | 'service';
    id: string;
    position: number;
    selectionValueIds: string[];
    mediaIds: string[];
    sku: string | null;
    status: 'active' | 'archived';
    title: string | null;
  }[];
};

function VisualConfigurationEditor({
  canReadInventory,
  canReadPricing,
  canWriteInventory,
  canWritePricing,
  isSubmitting,
  onSubmit,
  product,
}: {
  readonly canReadInventory: boolean;
  readonly canReadPricing: boolean;
  readonly canWriteInventory: boolean;
  readonly canWritePricing: boolean;
  readonly isSubmitting: boolean;
  readonly onSubmit: (input: ProductConfigurationInput) => Promise<void>;
  readonly product: AdminProduct;
}) {
  const [draft, setDraft] = useState(() => configurationDraft(product));
  const [validation, setValidation] = useState<string>();
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [inventoryDraft, setInventoryDraft] = useState<
    Record<
      string,
      {
        mode: 'not_configured' | 'tracked' | 'untracked';
        onHand: string;
        reason: string;
      }
    >
  >({});
  const variantIds = product.variants.map((variant) => variant.id);
  const prices = useQuery({
    enabled: canReadPricing && variantIds.length > 0,
    queryKey: ['catalog', 'variant-prices', product.id, product.version],
    queryFn: () => listCurrentPrices(variantIds),
  });
  const inventory = useQuery({
    enabled: canReadInventory && variantIds.length > 0,
    queryKey: ['catalog', 'variant-inventory', product.id, product.version],
    queryFn: () => listCurrentInventory(variantIds),
  });
  useEffect(() => {
    if (prices.data)
      // The query is external state; seed the local editor only when it arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPriceDraft(
        Object.fromEntries(
          prices.data.map((price) => [
            price.variantId,
            price.state === 'priced' ? (price.amount ?? '') : '',
          ]),
        ),
      );
  }, [prices.data]);
  useEffect(() => {
    if (inventory.data)
      // The query is external state; seed the local editor only when it arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInventoryDraft(
        Object.fromEntries(
          inventory.data.map((item: CurrentInventory) => [
            item.variantId,
            {
              mode: item.state,
              onHand: item.onHand === null ? '' : String(item.onHand),
              reason: '',
            },
          ]),
        ),
      );
  }, [inventory.data]);
  const savedVariantIds = new Set(
    product.variants.map((variant) => variant.id),
  );
  const generate = () => {
    const combinations = optionCombinations(draft.options);
    if (!combinations) {
      setValidation(
        'برای ساخت گونه‌ها، برای هر گزینه دست‌کم یک مقدار وارد کنید.',
      );
      return;
    }
    const existing = new Map(
      draft.variants.map((variant) => [
        selectionKey(variant.selectionValueIds),
        variant,
      ]),
    );
    setDraft((current) => ({
      ...current,
      variants: combinations.map(
        (selectionValueIds, position) =>
          existing.get(selectionKey(selectionValueIds)) ?? {
            id: newClientId(),
            fulfillmentClassification:
              current.variants[0]?.fulfillmentClassification ?? 'physical',
            position,
            selectionValueIds,
            mediaIds: [],
            sku: null,
            status: 'active' as const,
            title: null,
          },
      ),
    }));
    setValidation(undefined);
  };
  const updateVariant = (
    index: number,
    patch: Partial<ConfigurationDraft['variants'][number]>,
  ) =>
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...patch } : variant,
      ),
    }));
  return (
    <form
      className="rounded-lg border border-border bg-card p-5"
      dir="rtl"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          draft.options.some(
            (option) =>
              !option.name.trim() ||
              option.values.some((value) => !value.label.trim()),
          )
        ) {
          setValidation('نام گزینه‌ها و مقدارهای آن‌ها الزامی است.');
          return;
        }
        setValidation(undefined);
        const operationalChanges =
          (canWritePricing && Object.keys(priceDraft).length > 0) ||
          (canWriteInventory && Object.keys(inventoryDraft).length > 0);
        if (
          operationalChanges &&
          !window.confirm(
            'تغییرات قیمت و موجودی ثبت و در تاریخچه ذخیره می‌شوند. ادامه می‌دهید؟',
          )
        )
          return;
        void onSubmit({
          ...draft,
          expectedVersion: product.version,
          ...(canWritePricing
            ? {
                prices: Object.entries(priceDraft).map(
                  ([variantId, amount]) => ({
                    variantId,
                    amount: amount.trim() || null,
                  }),
                ),
              }
            : {}),
          ...(canWriteInventory
            ? {
                inventory: Object.entries(inventoryDraft).map(
                  ([variantId, value]) => ({
                    variantId,
                    trackingMode: value.mode,
                    currentOnHand:
                      value.mode === 'tracked' && value.onHand.trim()
                        ? Number(value.onHand)
                        : null,
                    reasonCode: value.reason.trim() || null,
                  }),
                ),
              }
            : {}),
        } as ProductConfigurationInput).catch(() => undefined);
      }}
    >
      <h2 className="font-semibold">پیکربندی گونه‌ها</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        گزینه‌ها را با فیلدهای عادی وارد کنید، ترکیب‌ها را پیش‌نمایش کنید و فقط
        ترکیب‌هایی را که می‌فروشید ذخیره کنید.
      </p>
      <div className="mt-4 space-y-4">
        {draft.options.map((option, optionIndex) => (
          <fieldset
            className="rounded-md border border-border p-4"
            key={option.id}
          >
            <legend className="px-1 text-sm font-medium">
              گزینه {optionIndex + 1}
            </legend>
            <input
              className="catalog-input"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  options: current.options.map((item, index) =>
                    index === optionIndex
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                }))
              }
              placeholder="مانند رنگ یا اندازه"
              value={option.name}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {option.values.map((value, valueIndex) => (
                <input
                  className="catalog-input"
                  key={value.id}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      options: current.options.map((item, index) =>
                        index !== optionIndex
                          ? item
                          : {
                              ...item,
                              values: item.values.map(
                                (candidate, candidateIndex) =>
                                  candidateIndex === valueIndex
                                    ? {
                                        ...candidate,
                                        label: event.target.value,
                                      }
                                    : candidate,
                              ),
                            },
                      ),
                    }))
                  }
                  placeholder={'مقدار ' + (valueIndex + 1)}
                  value={value.label}
                />
              ))}
            </div>
            <Button
              className="mt-3"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  options: current.options.map((item, index) =>
                    index !== optionIndex
                      ? item
                      : {
                          ...item,
                          values: [
                            ...item.values,
                            {
                              id: newClientId(),
                              label: '',
                              position: item.values.length,
                            },
                          ],
                        },
                  ),
                }))
              }
              size="sm"
              type="button"
              variant="outline"
            >
              افزودن مقدار
            </Button>
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={draft.options.length >= 5}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              options: [
                ...current.options,
                {
                  id: newClientId(),
                  name: '',
                  position: current.options.length,
                  values: [{ id: newClientId(), label: '', position: 0 }],
                },
              ],
            }))
          }
          type="button"
          variant="outline"
        >
          افزودن گزینه
        </Button>
        <Button onClick={generate} type="button" variant="outline">
          ساخت ترکیب‌های انتخاب‌شده
        </Button>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="border-b border-border text-right text-muted-foreground">
            <tr>
              <th className="pb-2">گونه</th>
              <th className="pb-2">عنوان</th>
              <th className="pb-2">قیمت</th>
              <th className="pb-2">موجودی</th>
              <th className="pb-2">کد کالا</th>
              <th className="pb-2">وضعیت</th>
              <th className="pb-2">تصاویر</th>
              <th className="pb-2">
                <span className="sr-only">حذف</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.variants.map((variant, index) => (
              <tr className="border-b border-border/60" key={variant.id}>
                <td className="py-3">
                  {variantLabel(variant, draft.options) || 'گونهٔ پیش‌فرض'}
                </td>
                <td className="py-3 pe-2">
                  <input
                    className="catalog-input"
                    onChange={(event) =>
                      updateVariant(index, {
                        title: event.target.value || null,
                      })
                    }
                    value={variant.title ?? ''}
                  />
                </td>
                <td className="py-3 pe-2">
                  {canReadPricing ? (
                    canWritePricing ? (
                      <input
                        className="catalog-input"
                        dir="ltr"
                        inputMode="decimal"
                        onChange={(event) =>
                          setPriceDraft((current) => ({
                            ...current,
                            [variant.id]: event.target.value,
                          }))
                        }
                        placeholder="قیمت درخواستی"
                        value={priceDraft[variant.id] ?? ''}
                      />
                    ) : (
                      <span dir="ltr">
                        {priceDraft[variant.id] || 'درخواست قیمت'}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      بدون دسترسی
                    </span>
                  )}
                </td>
                <td className="py-3 pe-2">
                  {canReadInventory ? (
                    canWriteInventory ? (
                      <div className="space-y-1">
                        <select
                          className="catalog-input"
                          onChange={(event) =>
                            setInventoryDraft((current) => ({
                              ...current,
                              [variant.id]: {
                                ...(current[variant.id] ?? {
                                  onHand: '',
                                  reason: '',
                                }),
                                mode: event.target.value as
                                  'not_configured' | 'tracked' | 'untracked',
                              },
                            }))
                          }
                          value={
                            inventoryDraft[variant.id]?.mode ?? 'not_configured'
                          }
                        >
                          <option value="not_configured">تنظیم نشده</option>
                          <option value="untracked">ردیابی نمی‌شود</option>
                          <option value="tracked">ردیابی‌شده</option>
                        </select>
                        {inventoryDraft[variant.id]?.mode === 'tracked' ? (
                          <input
                            className="catalog-input"
                            inputMode="numeric"
                            onChange={(event) =>
                              setInventoryDraft((current) => ({
                                ...current,
                                [variant.id]: {
                                  ...(current[variant.id] ?? {
                                    mode: 'tracked',
                                    reason: '',
                                  }),
                                  onHand: event.target.value,
                                },
                              }))
                            }
                            placeholder="موجودی"
                            value={inventoryDraft[variant.id]?.onHand ?? ''}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <span>
                        {inventoryDraft[variant.id]?.mode === 'untracked'
                          ? 'ردیابی نمی‌شود'
                          : inventoryDraft[variant.id]?.mode === 'tracked'
                            ? inventoryDraft[variant.id]?.onHand
                            : 'تنظیم نشده'}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      بدون دسترسی
                    </span>
                  )}
                </td>
                <td className="py-3 pe-2">
                  <input
                    className="catalog-input"
                    dir="ltr"
                    onChange={(event) =>
                      updateVariant(index, { sku: event.target.value || null })
                    }
                    value={variant.sku ?? ''}
                  />
                </td>
                <td className="py-3 pe-2">
                  <select
                    className="catalog-input"
                    onChange={(event) =>
                      updateVariant(index, {
                        status: event.target.value as 'active' | 'archived',
                      })
                    }
                    value={variant.status}
                  >
                    <option value="active">فعال</option>
                    <option value="archived">بایگانی‌شده</option>
                  </select>
                </td>
                <td className="py-3 pe-2">
                  <div className="flex flex-wrap gap-2">
                    {product.media.length ? (
                      product.media.map((media) => (
                        <label
                          className="flex items-center gap-1 text-xs"
                          key={media.id}
                        >
                          <input
                            checked={variant.mediaIds.includes(media.id)}
                            onChange={() =>
                              setDraft((current) => ({
                                ...current,
                                variants: current.variants.map(
                                  (item, itemIndex) =>
                                    itemIndex !== index
                                      ? item
                                      : {
                                          ...item,
                                          mediaIds: item.mediaIds.includes(
                                            media.id,
                                          )
                                            ? item.mediaIds.filter(
                                                (id) => id !== media.id,
                                              )
                                            : [...item.mediaIds, media.id],
                                        },
                                ),
                              }))
                            }
                            type="checkbox"
                          />
                          {media.position + 1}
                        </label>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        بدون تصویر
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-end">
                  <Button
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        variants: current.variants
                          .map((item) =>
                            item.id !== variant.id
                              ? item
                              : savedVariantIds.has(item.id)
                                ? { ...item, status: 'archived' as const }
                                : null,
                          )
                          .filter(
                            (
                              item,
                            ): item is ConfigurationDraft['variants'][number] =>
                              Boolean(item),
                          )
                          .map((item, position) => ({ ...item, position })),
                      }))
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {savedVariantIds.has(variant.id) ? 'بایگانی' : 'حذف'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {validation ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {validation}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button disabled={isSubmitting} type="submit">
          <FilePenLine aria-hidden="true" />{' '}
          {isSubmitting ? 'در حال ذخیره…' : 'ذخیرهٔ گونه‌ها'}
        </Button>
      </div>
    </form>
  );
}

export function ConfigurationEditor({
  isSubmitting,
  onSubmit,
  product,
}: {
  readonly isSubmitting: boolean;
  readonly onSubmit: (input: ProductConfigurationInput) => Promise<void>;
  readonly product: AdminProduct;
}) {
  const initial = JSON.stringify(
    {
      options: product.options,
      variants: product.variants.map(
        ({
          fulfillmentClassification,
          id,
          position,
          selectionValueIds,
          sku,
          status,
          title,
        }) => ({
          fulfillmentClassification,
          id,
          position,
          selectionValueIds,
          sku,
          status,
          title,
        }),
      ),
    },
    null,
    2,
  );
  const [text, setText] = useState(initial);
  const [validation, setValidation] = useState<string>();
  return (
    <form
      className="rounded-lg border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const parsed: unknown = JSON.parse(text);
          if (!isConfigurationPayload(parsed))
            throw new Error('ساختار باید شامل گزینه‌ها و گونه‌ها باشد.');
          setValidation(undefined);
          void onSubmit({ ...parsed, expectedVersion: product.version }).catch(
            () => undefined,
          );
        } catch (error) {
          setValidation(
            error instanceof Error ? error.message : 'پیکربندی معتبر نیست.',
          );
        }
      }}
    >
      <h2 className="font-semibold">پیکربندی گونه‌ها</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        این عملیات کل گزینه‌ها و گونه‌ها را به‌صورت یکجا جایگزین می‌کند.
        شناسه‌های موجود را برای حفظ همان گزینه یا گونه نگه دارید.
      </p>
      <label className="mt-4 block text-sm font-medium">
        پیکربندی JSON
        <textarea
          aria-describedby="configuration-help"
          className="catalog-input min-h-96 resize-y py-3 font-mono text-xs leading-6"
          dir="ltr"
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          value={text}
        />
      </label>
      <p className="catalog-help" id="configuration-help">
        پیش از ذخیره، ساختار در مرورگر بررسی می‌شود؛ اعتبار نهایی با سرویس است.
      </p>
      {validation ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {validation}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button disabled={isSubmitting} type="submit">
          <FilePenLine aria-hidden="true" />{' '}
          {isSubmitting ? 'در حال ذخیره…' : 'جایگزینی پیکربندی'}
        </Button>
      </div>
    </form>
  );
}

function ConfigurationReadOnly({
  product,
}: {
  readonly product: AdminProduct;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold">گونه‌ها و گزینه‌ها</h2>
      <div className="mt-4 space-y-3">
        {product.options.map((option) => (
          <div className="rounded-md bg-muted/55 p-3" key={option.id}>
            <p className="font-medium">{option.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {option.values.map((value) => value.label).join('، ') ||
                'بدون مقدار'}
            </p>
          </div>
        ))}
        {product.variants.map((variant) => (
          <div
            className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm"
            key={variant.id}
          >
            <span>
              {variant.title ?? 'گونه بدون عنوان'} ·{' '}
              {fulfillmentLabel(variant.fulfillmentClassification)}
            </span>
            <span>
              <bdi dir="ltr">{variant.sku ?? '—'}</bdi> ·{' '}
              {variant.status === 'active' ? 'فعال' : 'بایگانی‌شده'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LifecycleActions({
  canArchive,
  canPublish,
  isSubmitting,
  onTransition,
  product,
}: {
  readonly canArchive: boolean;
  readonly canPublish: boolean;
  readonly isSubmitting: boolean;
  readonly onTransition: (
    action: 'publish' | 'unpublish' | 'archive' | 'restore',
  ) => Promise<void>;
  readonly product: AdminProduct;
}) {
  const actions =
    product.status === 'draft'
      ? canPublish
        ? [{ action: 'publish' as const, label: 'انتشار', icon: Send }]
        : []
      : product.status === 'published'
        ? [
            {
              action: 'unpublish' as const,
              label: 'بازگرداندن به پیش‌نویس',
              icon: Undo2,
            },
            ...(canArchive
              ? [
                  {
                    action: 'archive' as const,
                    label: 'بایگانی',
                    icon: Archive,
                  },
                ]
              : []),
          ]
        : canArchive
          ? [
              {
                action: 'restore' as const,
                label: 'بازیابی به پیش‌نویس',
                icon: RotateCcw,
              },
            ]
          : [];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ action, icon: Icon, label }) => (
        <Button
          className={
            action === 'archive'
              ? 'text-destructive hover:text-destructive'
              : undefined
          }
          disabled={isSubmitting}
          key={action}
          onClick={() => void onTransition(action).catch(() => undefined)}
          size="sm"
          variant="outline"
        >
          <Icon aria-hidden="true" /> {label}
        </Button>
      ))}
    </div>
  );
}

function CatalogProblem({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry?: () => void;
}) {
  return (
    <section
      className="rounded-lg border border-destructive/25 bg-card px-5 py-6"
      dir="rtl"
      role="alert"
    >
      <h2 className="font-semibold">دریافت یا ذخیره کالا انجام نشد</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {catalogErrorMessage(error)}
      </p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} variant="outline">
          <RefreshCw aria-hidden="true" /> تلاش دوباره
        </Button>
      ) : null}
    </section>
  );
}
function CatalogEmpty() {
  return (
    <section
      className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 text-center"
      dir="rtl"
    >
      <PackagePlus
        aria-hidden="true"
        className="size-8 text-muted-foreground"
      />
      <h2 className="mt-4 text-lg font-semibold">کالایی پیدا نشد</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        فیلترها را تغییر دهید یا اولین کالای فروشگاه را ایجاد کنید.
      </p>
    </section>
  );
}
function CatalogSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="در حال دریافت کالاها"
      className="space-y-4"
      dir="rtl"
    >
      <div className="h-8 w-28 animate-pulse rounded bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      {Array.from({ length: 5 }, (_, index) => (
        <div className="h-16 animate-pulse rounded-lg bg-muted" key={index} />
      ))}
    </section>
  );
}
function Field({
  children,
  label,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
function Definition({
  label,
  ltr,
  value,
}: {
  readonly label: string;
  readonly value: string;
  readonly ltr?: boolean;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">
        {ltr ? <bdi dir="ltr">{value}</bdi> : value}
      </dd>
    </div>
  );
}
function ProductStatus({
  status,
}: {
  readonly status: AdminProduct['status'];
}) {
  const tone =
    status === 'published'
      ? 'bg-emerald-700/10 text-emerald-800'
      : status === 'archived'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-amber-700/10 text-amber-900';
  const label =
    status === 'published'
      ? 'منتشرشده'
      : status === 'archived'
        ? 'بایگانی‌شده'
        : 'پیش‌نویس';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
function fulfillmentLabel(value: 'physical' | 'digital' | 'service') {
  return value === 'physical'
    ? 'فیزیکی'
    : value === 'digital'
      ? 'دیجیتال'
      : 'خدمات';
}
function nullableText(value: string) {
  return (value.trim() || null) as never;
}
function toCreateProductInput(value: ProductFormValue) {
  return {
    defaultVariantSku: nullableText(value.defaultVariantSku),
    defaultVariantTitle: nullableText(value.defaultVariantTitle),
    description: nullableText(value.description),
    fulfillmentClassification: value.fulfillmentClassification,
    slug: value.slug,
    summary: nullableText(value.summary),
    title: value.title,
  };
}
function confirmTransition(
  action: 'publish' | 'unpublish' | 'archive' | 'restore',
  title: string,
) {
  const message =
    action === 'publish'
      ? `«${title}» منتشر شود؟`
      : action === 'unpublish'
        ? `«${title}» به پیش‌نویس برگردد؟`
        : action === 'archive'
          ? `«${title}» بایگانی شود؟`
          : `«${title}» به پیش‌نویس بازیابی شود؟`;
  return window.confirm(message);
}
function catalogErrorMessage(error: unknown) {
  if (isAdminApiError(error) && error.problem.kind === 'api') {
    if (error.problem.status === 403)
      return 'حساب شما اجازه انجام این عملیات را ندارد.';
    if (error.problem.status === 404)
      return 'کالای موردنظر پیدا نشد یا دیگر در دسترس نیست.';
    if (error.problem.status === 409)
      return 'کالا هم‌زمان تغییر کرده است. اطلاعات را تازه‌سازی و دوباره بررسی کنید.';
    if (error.problem.status === 400)
      return 'اطلاعات کالا یا پیکربندی آن معتبر نیست.';
  }
  return 'پاسخ معتبری از سرویس کالاها دریافت نشد. دوباره تلاش کنید.';
}
function isConflict(error: unknown) {
  return (
    isAdminApiError(error) &&
    error.problem.kind === 'api' &&
    error.problem.status === 409
  );
}
function configurationDraft(product: AdminProduct): ConfigurationDraft {
  return {
    options: product.options.map((option, position) => ({
      id: option.id,
      name: option.name,
      position,
      values: option.values.map((value, valuePosition) => ({
        id: value.id,
        label: value.label,
        position: valuePosition,
      })),
    })),
    variants: product.variants.map((variant, position) => ({
      fulfillmentClassification: variant.fulfillmentClassification,
      id: variant.id,
      position,
      selectionValueIds: [...variant.selectionValueIds],
      mediaIds: (variant as typeof variant & { mediaIds?: readonly string[] })
        .mediaIds
        ? [
            ...(
              variant as typeof variant & {
                mediaIds?: readonly string[];
              }
            ).mediaIds!,
          ]
        : [],
      sku: variant.sku,
      status: variant.status,
      title: variant.title,
    })),
  };
}
function newClientId(): string {
  return crypto.randomUUID();
}
function selectionKey(ids: readonly string[]): string {
  return [...ids].sort().join(':');
}
function optionCombinations(
  options: ConfigurationDraft['options'],
): string[][] | null {
  if (!options.length) return [[]];
  if (options.some((option) => !option.values.length)) return null;
  return options.reduce<string[][]>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => [...combination, value.id]),
      ),
    [[]],
  );
}
function variantLabel(
  variant: ConfigurationDraft['variants'][number],
  options: ConfigurationDraft['options'],
): string {
  const labels = new Map(
    options.flatMap((option) =>
      option.values.map((value) => [value.id, value.label] as const),
    ),
  );
  return variant.selectionValueIds
    .map((selectionId) => labels.get(selectionId))
    .filter((label): label is string => Boolean(label))
    .join(' · ');
}
function isConfigurationPayload(
  value: unknown,
): value is Omit<ProductConfigurationInput, 'expectedVersion'> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { options?: unknown }).options) &&
    Array.isArray((value as { variants?: unknown }).variants),
  );
}
