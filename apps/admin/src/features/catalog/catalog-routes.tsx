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
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import './catalog.css';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { isAdminApiError } from '@/api/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field as FormField,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  ModalLayer,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/ui';
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
  ProductWorkspaceTabs,
  type ProductWorkspaceTab,
} from './components/product-workspace-tabs';
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
  onTabChange,
  productId,
  tab,
}: {
  readonly onBack: () => void;
  readonly onTabChange: (tab: ProductWorkspaceTab) => void;
  readonly productId: string;
  readonly tab: ProductWorkspaceTab;
}) {
  return (
    <CatalogProductContent
      productId={productId}
      onBack={onBack}
      onTabChange={onTabChange}
      tab={tab}
    />
  );
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
        onBack={() => setSearch({ product: undefined, tab: undefined })}
        onTabChange={(tab) => setSearch({ tab })}
        productId={search.product}
        tab={search.tab ?? 'general'}
      />
    );
  if (search.create)
    return (
      <CreateProductScreen
        onBack={() => setSearch({ create: undefined })}
        onCreated={(productId) =>
          setSearch({ create: undefined, product: productId, tab: 'general' })
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
  readonly tab?: ProductWorkspaceTab;
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
    <section aria-labelledby="catalog-heading" className="flex flex-col gap-5" dir="rtl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-[-0.025em]"
            id="catalog-heading"
          >
            کالاها
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
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
      <Card>
        <CardContent>
          <form onSubmit={applyFilters}>
            <FieldGroup className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,.55fr)_12rem_auto] md:items-end">
              <FormField>
                <FieldLabel htmlFor="product-search">نام یا نامک</FieldLabel>
                <Input
                  id="product-search"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      q: event.target.value,
                    }))
                  }
                  placeholder="جست‌وجوی کالا"
                  value={filters.q}
                />
              </FormField>
              <FormField>
                <FieldLabel htmlFor="product-sku">کد کالا</FieldLabel>
                <Input
                  dir="ltr"
                  id="product-sku"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                  placeholder="SKU"
                  value={filters.sku}
                />
              </FormField>
              <FormField>
                <FieldLabel htmlFor="product-status">وضعیت</FieldLabel>
                <Select
                  onValueChange={(status) =>
                    setFilters((current) => ({
                      ...current,
                      status: status === 'all' ? '' : status,
                    }))
                  }
                  value={filters.status || 'all'}
                >
                  <SelectTrigger id="product-status">
                    <SelectValue placeholder="همه وضعیت‌ها" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                      <SelectItem value="draft">پیش‌نویس</SelectItem>
                      <SelectItem value="published">منتشرشده</SelectItem>
                      <SelectItem value="archived">بایگانی‌شده</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>
              <Button type="submit" variant="outline">
                اعمال فیلتر
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
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
          <div className="grid gap-3 md:hidden">
            {products.data.items.map((product) => (
              <ProductCard
                key={product.id}
                onSelect={() =>
                  onSearchChange({ product: product.id, create: undefined })
                }
                product={product}
              />
            ))}
          </div>
          <Card className="hidden md:flex">
            <CardContent className="px-0">
              <Table>
                <TableCaption className="sr-only">
                  فهرست کالاهای فروشگاه
                </TableCaption>
                <TableHeader className="bg-muted/45">
                  <TableRow>
                    <TableHead scope="col">نام کالا</TableHead>
                    <TableHead scope="col">نامک</TableHead>
                    <TableHead scope="col">وضعیت</TableHead>
                    <TableHead scope="col">آخرین تغییر</TableHead>
                    <TableHead scope="col">
                      <span className="sr-only">مشاهده</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {products.data.items.map((product) => (
                  <ProductRow
                    key={product.id}
                    onSelect={() =>
                      onSearchChange({ product: product.id, create: undefined })
                    }
                    product={product}
                  />
                ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
              <ChevronRight aria-hidden="true" data-icon="inline-start" /> صفحه پیشین
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
              صفحه بعد <ChevronLeft aria-hidden="true" data-icon="inline-end" />
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
    <TableRow>
      <TableCell className="font-medium">
        {product.title}
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          نسخه {product.version.toLocaleString('fa-IR')}
        </p>
      </TableCell>
      <TableCell className="max-w-56 text-muted-foreground">
        <bdi className="block truncate" dir="ltr">{product.slug}</bdi>
      </TableCell>
      <TableCell>
        <ProductStatus status={product.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatDate(product.updatedAt)}
      </TableCell>
      <TableCell className="text-left">
        <Button
          aria-label={`مشاهده ${product.title}`}
          onClick={onSelect}
          size="sm"
          variant="ghost"
        >
          جزئیات <ChevronLeft aria-hidden="true" data-icon="inline-end" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ProductCard({
  onSelect,
  product,
}: {
  readonly onSelect: () => void;
  readonly product: AdminProductSummary;
}) {
  return (
    <button
      aria-label={`مشاهده ${product.title}`}
      className="flex w-full flex-col gap-3 rounded-xl bg-card p-4 text-right ring-1 ring-foreground/10 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
      onClick={onSelect}
      type="button"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-medium">{product.title}</span>
          <bdi className="mt-1 block truncate text-xs text-muted-foreground" dir="ltr">
            {product.slug}
          </bdi>
        </span>
        <ChevronLeft aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </span>
      <span className="flex w-full items-center justify-between gap-3">
        <ProductStatus status={product.status} />
        <span className="text-xs text-muted-foreground">
          {formatDate(product.updatedAt)}
        </span>
      </span>
    </button>
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
  onTabChange,
  productId,
  tab,
}: {
  readonly onBack: () => void;
  readonly onTabChange: (tab: ProductWorkspaceTab) => void;
  readonly productId: string;
  readonly tab: ProductWorkspaceTab;
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
    <article className="mx-auto flex max-w-[90rem] flex-col gap-5" dir="rtl">
      <header className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pt-2 backdrop-blur-sm">
        <div className="flex flex-col gap-4 border-b border-border pb-4">
          <Button className="w-fit" onClick={onBack} size="sm" variant="ghost">
            بازگشت به کالاها
          </Button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-[-0.025em]">
                  {product.data.title}
                </h1>
                <ProductStatus status={product.data.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                نامک: <bdi dir="ltr">{product.data.slug}</bdi>
                <span aria-hidden="true"> · </span>
                نسخه {product.data.version.toLocaleString('fa-IR')}
              </p>
            </div>
            <LifecycleActions
              canArchive={canArchive}
              canPublish={canPublish}
              isSubmitting={isSubmitting}
              onTransition={async (action) => {
                await transition.mutateAsync({
                  action,
                  expectedVersion: product.data.version,
                  productId,
                });
                await refresh();
              }}
              product={product.data}
            />
          </div>
        </div>
        <ProductWorkspaceTabs onChange={onTabChange} value={tab} />
      </header>
      {error ? <CatalogProblem error={error} /> : null}
      {tab === 'general' && canWrite ? (
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
      ) : tab === 'general' ? (
        <ProductReadOnly product={product.data} />
      ) : null}
      {tab === 'organization' ? (
        !canReadCategories ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">برای مشاهده دسته‌بندی‌های این کالا دسترسی لازم را ندارید.</p>
        ) : categories.isPending ? (
          <CatalogSkeleton />
        ) : categories.isError ? (
          <CatalogProblem error={categories.error} onRetry={() => void categories.refetch()} />
        ) : canWrite ? (
          <ProductCategoryEditor
            categories={categories.data.items}
            isSubmitting={isSubmitting}
            key={`categories-${product.data.version}`}
            onSubmit={async (categoryIds) => {
              await replaceCategories.mutateAsync({ categoryIds, expectedVersion: product.data.version, id: productId });
              await refresh();
            }}
            product={product.data}
          />
        ) : (
          <ProductCategoryReadOnly categories={categories.data.items} product={product.data} />
        )
      ) : null}
      {tab === 'media' ? <ProductMediaEditor canWrite={canWrite} onChanged={refresh} product={product.data} /> : null}
      {tab === 'variants' && canWrite ? (
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
      ) : tab === 'variants' ? (
        <ConfigurationReadOnly product={product.data} />
      ) : null}
      {tab === 'activity' && canReadActivity ? (
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
      ) : tab === 'activity' ? <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">برای مشاهده فعالیت‌های این کالا دسترسی لازم را ندارید.</p> : null}
    </article>
  );
}

function ProductCategoryReadOnly({
  categories,
  product,
}: {
  readonly categories: readonly { id: string; title: string }[];
  readonly product: AdminProduct;
}) {
  const selected = categories.filter((category) =>
    product.categoryIds.includes(category.id),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>دسته‌بندی‌های کالا</CardTitle>
        <CardDescription>جایگاه فعلی این کالا در ساختار فروشگاه</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-7 text-muted-foreground">
          {selected.length
            ? selected.map((category) => category.title).join('، ')
            : 'این کالا هنوز در دسته‌بندی‌ای قرار نگرفته است.'}
        </p>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>دسته‌بندی‌های کالا</CardTitle>
        <CardDescription>
          دسته‌بندی‌هایی را انتخاب کنید که مشتری باید این کالا را در آن‌ها پیدا کند.
        </CardDescription>
      </CardHeader>
      <CardContent>
      {categories.length ? (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">دسته‌بندی‌های کالا</legend>
          {categories.map((category) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/45"
              htmlFor={`category-${category.id}`}
              key={category.id}
            >
              <Checkbox
                checked={selected.has(category.id)}
                disabled={isSubmitting}
                id={`category-${category.id}`}
                onCheckedChange={() => toggle(category.id)}
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
        <p className="text-sm text-muted-foreground">
          هنوز دسته‌بندی‌ای برای انتخاب وجود ندارد.
        </p>
      )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          disabled={isSubmitting}
          onClick={() => void onSubmit([...selected]).catch(() => undefined)}
        >
          <Save aria-hidden="true" data-icon="inline-start" />{' '}
          {isSubmitting ? 'در حال ذخیره…' : 'ذخیره دسته‌بندی‌ها'}
        </Button>
      </CardFooter>
    </Card>
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

function initialProductFormValue(initial?: AdminProduct): ProductFormValue {
  return {
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    summary: initial?.summary ?? '',
    description: initial?.description ?? '',
    defaultVariantTitle: initial?.variants[0]?.title ?? '',
    defaultVariantSku: initial?.variants[0]?.sku ?? '',
    fulfillmentClassification:
      initial?.variants[0]?.fulfillmentClassification ?? 'physical',
  };
}

function recoveredProductDraft(key: string | undefined) {
  if (!key) return undefined;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return undefined;
    const candidate = parsed as Partial<ProductFormValue>;
    return typeof candidate.title === 'string' &&
      typeof candidate.slug === 'string' &&
      typeof candidate.summary === 'string' &&
      typeof candidate.description === 'string'
      ? (candidate as ProductFormValue)
      : undefined;
  } catch {
    return undefined;
  }
}

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
  const baseline = useMemo(() => initialProductFormValue(initial), [initial]);
  const draftKey = initial
    ? `better-commerce.admin.product-draft.${initial.id}`
    : undefined;
  const recovered = useMemo(() => recoveredProductDraft(draftKey), [draftKey]);
  const [value, setValue] = useState<ProductFormValue>(() => recovered ?? baseline);
  const isDirty = JSON.stringify(value) !== JSON.stringify(baseline);
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (isDirty) localStorage.setItem(draftKey, JSON.stringify(value));
      else localStorage.removeItem(draftKey);
    } catch {
      // Draft recovery is best-effort in restricted browser contexts.
    }
  }, [draftKey, isDirty, value]);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);
  const set = <K extends keyof ProductFormValue>(
    key: K,
    next: ProductFormValue[K],
  ) => setValue((current) => ({ ...current, [key]: next }));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(value)
          .then(() => {
            if (draftKey) localStorage.removeItem(draftKey);
          })
          .catch(() => undefined);
      }}
    >
      {recovered ? (
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground" role="status">
          تغییرات ذخیره‌نشده قبلی بازیابی شد.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>اطلاعات کالا</CardTitle>
                {isDirty ? (
                  <StatusBadge tone="warning">ذخیره‌نشده</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">بدون تغییر</StatusBadge>
                )}
              </div>
              <CardDescription>
                نام و توضیحاتی که مشتری در فروشگاه مشاهده می‌کند.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FormField>
                  <FieldLabel htmlFor="product-title">نام کالا</FieldLabel>
                  <Input
                    id="product-title"
                    onChange={(event) => set('title', event.target.value)}
                    required
                    value={value.title}
                  />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField>
                    <FieldLabel htmlFor="product-slug">نامک</FieldLabel>
                    <Input
                      dir="ltr"
                      id="product-slug"
                      onChange={(event) => set('slug', event.target.value)}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      required
                      value={value.slug}
                    />
                    <FieldDescription>
                      حروف کوچک انگلیسی، عدد و خط تیره
                    </FieldDescription>
                  </FormField>
                  {!initial ? (
                    <FormField>
                      <FieldLabel htmlFor="product-fulfillment">نوع تأمین</FieldLabel>
                      <Select
                        onValueChange={(next) =>
                          set(
                            'fulfillmentClassification',
                            next as ProductFormValue['fulfillmentClassification'],
                          )
                        }
                        value={value.fulfillmentClassification}
                      >
                        <SelectTrigger id="product-fulfillment">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="physical">فیزیکی</SelectItem>
                            <SelectItem value="digital">دیجیتال</SelectItem>
                            <SelectItem value="service">خدمات</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormField>
                  ) : null}
                </div>
                <FormField>
                  <FieldLabel htmlFor="product-summary">خلاصه</FieldLabel>
                  <Input
                    id="product-summary"
                    onChange={(event) => set('summary', event.target.value)}
                    value={value.summary}
                  />
                </FormField>
                <FormField>
                  <FieldLabel htmlFor="product-description">توضیحات</FieldLabel>
                  <Textarea
                    className="min-h-36"
                    id="product-description"
                    onChange={(event) => set('description', event.target.value)}
                    value={value.description}
                  />
                </FormField>
              </FieldGroup>
            </CardContent>
          </Card>
          {!initial ? (
            <Card>
              <CardHeader>
                <CardTitle>گونه پیش‌فرض</CardTitle>
                <CardDescription>
                  پس از ساخت پیش‌نویس می‌توانید گزینه‌ها و گونه‌های بیشتری اضافه کنید.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-4 md:grid-cols-2">
                  <FormField>
                    <FieldLabel htmlFor="default-variant-title">عنوان گونه</FieldLabel>
                    <Input
                      id="default-variant-title"
                      onChange={(event) =>
                        set('defaultVariantTitle', event.target.value)
                      }
                      value={value.defaultVariantTitle}
                    />
                  </FormField>
                  <FormField>
                    <FieldLabel htmlFor="default-variant-sku">کد کالا</FieldLabel>
                    <Input
                      dir="ltr"
                      id="default-variant-sku"
                      onChange={(event) =>
                        set('defaultVariantSku', event.target.value)
                      }
                      value={value.defaultVariantSku}
                    />
                  </FormField>
                </FieldGroup>
              </CardContent>
            </Card>
          ) : null}
        </div>
        <Card className="lg:sticky lg:top-44">
          <CardHeader>
            <CardTitle>ذخیره این بخش</CardTitle>
            <CardDescription>
              تصاویر، دسته‌بندی‌ها و گونه‌ها در بخش‌های خودشان ذخیره می‌شوند.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" disabled={isSubmitting || !isDirty} type="submit">
              <Save aria-hidden="true" data-icon="inline-start" />
              {isSubmitting ? 'در حال ذخیره…' : submitLabel}
            </Button>
          </CardFooter>
        </Card>
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
  const [selectedFile, setSelectedFile] = useState<File>();
  const [uploadAltText, setUploadAltText] = useState('');
  const [dragActive, setDragActive] = useState(false);
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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h2 className="text-lg font-semibold">کتابخانه تصاویر</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          تصویر اول، تصویر اصلی کالا است. برای دسترس‌پذیری هر تصویر متن جایگزین
          بنویسید.
        </p>
        </div>
        <StatusBadge tone={items.length >= 20 ? 'warning' : 'neutral'}>{items.length.toLocaleString('fa-IR')} از ۲۰ تصویر</StatusBadge>
      </div>
      {error ? <CatalogProblem error={error} /> : null}
      {items.length ? (
        <ol className="catalog-media-grid">
          {items.map((item, index) => (
            <li key={item.id}>
              {index === 0 ? <span className="absolute m-2 rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">تصویر اصلی</span> : null}
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
            className="grid w-full gap-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(14rem,1fr)_auto] lg:items-end"
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const file = event.dataTransfer.files.item(0);
              if (file?.type.match(/^image\/(jpeg|png|webp)$/)) setSelectedFile(file);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedFile || selectedFile.size === 0) return;
              void upload
                .mutateAsync({
                  altText: uploadAltText,
                  expectedVersion: product.version,
                  file: selectedFile,
                  productId: product.id,
                })
                .then(async () => {
                  setSelectedFile(undefined);
                  setUploadAltText('');
                  await onChanged();
                })
                .catch(() => undefined);
            }}
          >
            <label className={dragActive ? 'flex min-h-24 cursor-pointer flex-col justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 p-4 text-sm' : 'flex min-h-24 cursor-pointer flex-col justify-center rounded-xl border-2 border-dashed border-border p-4 text-sm hover:border-primary/40'}>
              <span className="font-medium">تصویر را اینجا رها کنید یا انتخاب کنید</span>
              <span className="mt-1 text-xs text-muted-foreground">JPEG، PNG یا WebP تا ۱۰ مگابایت</span>
              {selectedFile ? <span className="mt-2 text-xs text-primary" dir="ltr">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span> : null}
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy || items.length >= 20}
                onChange={(event) => setSelectedFile(event.target.files?.[0])}
                required
                type="file"
              />
            </label>
            <Field label="متن جایگزین">
              <input className="catalog-input" maxLength={300} onChange={(event) => setUploadAltText(event.target.value)} value={uploadAltText} />
            </Field>
            <Button disabled={busy || items.length >= 20 || !selectedFile} type="submit">
              <ImagePlus aria-hidden="true" /> {upload.isPending ? 'در حال بارگذاری…' : 'بارگذاری تصویر'}
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
  const [reviewOpen, setReviewOpen] = useState(false);
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
  const originalPrices = new Map(
    (prices.data ?? []).map((price) => [
      price.variantId,
      price.state === 'priced' ? (price.amount ?? '') : '',
    ]),
  );
  const changedPrices = Object.entries(priceDraft).filter(
    ([variantId, amount]) => amount.trim() !== (originalPrices.get(variantId) ?? ''),
  );
  const originalInventory = new Map(
    (inventory.data ?? []).map((item) => [item.variantId, item] as const),
  );
  const changedInventory = Object.entries(inventoryDraft).filter(
    ([variantId, value]) => {
      const original = originalInventory.get(variantId);
      return (
        value.mode !== (original?.state ?? 'not_configured') ||
        (value.mode === 'tracked' && value.onHand !== String(original?.onHand ?? '')) ||
        Boolean(value.reason.trim())
      );
    },
  );
  const submitDraft = () =>
    onSubmit({
      ...draft,
      expectedVersion: product.version,
      ...(canWritePricing
        ? { prices: changedPrices.map(([variantId, amount]) => ({ variantId, amount: amount.trim() || null })) }
        : {}),
      ...(canWriteInventory
        ? {
            inventory: changedInventory.map(([variantId, value]) => ({
              variantId,
              trackingMode: value.mode,
              currentOnHand:
                value.mode === 'tracked' && value.onHand.trim()
                  ? Number(value.onHand)
                  : null,
              reasonCode: value.reason.trim() || null,
            })),
          }
        : {}),
    } as ProductConfigurationInput);
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
        if (changedInventory.some(([, value]) => !value.reason.trim())) {
          setValidation('برای هر تغییر موجودی، دلیل تغییر را وارد کنید.');
          return;
        }
        setValidation(undefined);
        if (changedPrices.length || changedInventory.length) {
          setReviewOpen(true);
          return;
        }
        void submitDraft().catch(() => undefined);
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
        <table className="variant-matrix w-full text-sm md:min-w-[62rem]">
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
                <td className="py-3" data-label="گونه">
                  {variantLabel(variant, draft.options) || 'گونهٔ پیش‌فرض'}
                </td>
                <td className="py-3 pe-2" data-label="عنوان">
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
                <td className="py-3 pe-2" data-label="قیمت">
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
                <td className="py-3 pe-2" data-label="موجودی">
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
                        <input
                          className="catalog-input"
                          onChange={(event) =>
                            setInventoryDraft((current) => ({
                              ...current,
                              [variant.id]: {
                                ...(current[variant.id] ?? {
                                  mode: 'not_configured',
                                  onHand: '',
                                }),
                                reason: event.target.value,
                              },
                            }))
                          }
                          placeholder="دلیل تغییر موجودی"
                          value={inventoryDraft[variant.id]?.reason ?? ''}
                        />
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
                <td className="py-3 pe-2" data-label="کد کالا">
                  <input
                    className="catalog-input"
                    dir="ltr"
                    onChange={(event) =>
                      updateVariant(index, { sku: event.target.value || null })
                    }
                    value={variant.sku ?? ''}
                  />
                </td>
                <td className="py-3 pe-2" data-label="وضعیت">
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
                <td className="py-3 pe-2" data-label="تصاویر">
                  <div className="flex flex-wrap gap-2">
                    {product.media.length ? (
                      product.media.map((media) => (
                        <label
                          className={variant.mediaIds.includes(media.id) ? 'relative cursor-pointer overflow-hidden rounded-lg ring-2 ring-primary ring-offset-2' : 'relative cursor-pointer overflow-hidden rounded-lg border border-border opacity-65 hover:opacity-100'}
                          key={media.id}
                          title={media.altText || `تصویر ${media.position + 1}`}
                        >
                          <input
                            checked={variant.mediaIds.includes(media.id)}
                            className="sr-only"
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
                          <img alt="" className="size-11 object-cover" height={44} src={media.url} width={44} />
                          <span className="sr-only">{media.altText || `تصویر ${media.position + 1}`}</span>
                        </label>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        بدون تصویر
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-end" data-label="عملیات">
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
      <ModalLayer onClose={() => setReviewOpen(false)} open={reviewOpen} title="بررسی تغییرات تجاری">
        <div className="p-5">
          <h2 className="text-lg font-semibold">بررسی تغییرات تجاری</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">این تغییرات پس از ثبت در تاریخچه باقی می‌مانند. پیش از ادامه تعداد موارد را بررسی کنید.</p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted p-4"><dt className="text-xs text-muted-foreground">قیمت‌های تغییرکرده</dt><dd className="mt-1 text-2xl font-semibold">{changedPrices.length.toLocaleString('fa-IR')}</dd></div>
            <div className="rounded-xl bg-muted p-4"><dt className="text-xs text-muted-foreground">موجودی‌های تغییرکرده</dt><dd className="mt-1 text-2xl font-semibold">{changedInventory.length.toLocaleString('fa-IR')}</dd></div>
          </dl>
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setReviewOpen(false)} type="button" variant="ghost">بازگشت</Button>
            <Button disabled={isSubmitting} onClick={() => void submitDraft().then(() => setReviewOpen(false)).catch(() => undefined)} type="button">تأیید و ثبت</Button>
          </div>
        </div>
      </ModalLayer>
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
  const [pendingAction, setPendingAction] = useState<
    'publish' | 'unpublish' | 'archive' | 'restore'
  >();
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
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ action, icon: Icon, label }) => (
          <Button
            disabled={isSubmitting}
            key={action}
            onClick={() => setPendingAction(action)}
            size="sm"
            variant={action === 'archive' ? 'destructive' : 'outline'}
          >
            <Icon aria-hidden="true" data-icon="inline-start" />
            {label}
          </Button>
        ))}
      </div>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setPendingAction(undefined);
        }}
        open={Boolean(pendingAction)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>بررسی تغییر وضعیت کالا</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction
                ? transitionDescription(pendingAction, product.title)
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingAction) return;
                void onTransition(pendingAction)
                  .then(() => setPendingAction(undefined))
                  .catch(() => undefined);
              }}
            >
              {isSubmitting ? 'در حال ثبت…' : 'تأیید تغییر وضعیت'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
    <Empty className="min-h-72 border border-dashed bg-card" dir="rtl">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackagePlus aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>کالایی پیدا نشد</EmptyTitle>
        <EmptyDescription>
          فیلترها را تغییر دهید یا اولین کالای فروشگاه را ایجاد کنید.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
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
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-16 rounded-lg" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton className="h-16 rounded-lg" key={index} />
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
      ? 'success'
      : status === 'archived'
        ? 'destructive'
        : 'warning';
  const label =
    status === 'published'
      ? 'منتشرشده'
      : status === 'archived'
        ? 'بایگانی‌شده'
        : 'پیش‌نویس';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
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
function transitionDescription(
  action: 'publish' | 'unpublish' | 'archive' | 'restore',
  title: string,
) {
  return (
    action === 'publish'
      ? `کالای «${title}» در فروشگاه منتشر می‌شود و برای مشتریان قابل مشاهده خواهد بود.`
      : action === 'unpublish'
        ? `کالای «${title}» به پیش‌نویس برمی‌گردد و از فروشگاه پنهان می‌شود.`
        : action === 'archive'
          ? `کالای «${title}» بایگانی می‌شود. اطلاعات و سابقه آن حفظ خواهد شد.`
          : `کالای «${title}» به‌صورت پیش‌نویس بازیابی می‌شود و پیش از انتشار قابل ویرایش است.`
  );
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
