import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  FolderPlus,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field as FormField,
  FieldLabel,
  Input,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/ui';
import { isAdminApiError } from '@/api/client';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminProductsListQueryOptions } from './api/catalog-query';
import type { AdminProductSummary } from './api/catalog-api';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import type {
  AdminCategory,
  AdminCollection,
  GroupingTextInput,
} from './api/catalog-navigation-api';
import {
  catalogNavigationKeys,
  categoriesQuery,
  collectionsQuery,
  createCategoryMutation,
  createCollectionMutation,
  moveCategoryMutation,
  productsCollectionMutation,
  transitionCategoryMutation,
  transitionCollectionMutation,
  updateCategoryMutation,
  updateCollectionMutation,
} from './api/catalog-navigation-query';
import './catalog.css';

type TextCommand = (value: GroupingTextInput) => Promise<void>;
const text = (form: HTMLFormElement): GroupingTextInput => {
  const data = new FormData(form);
  const value = (key: string) => {
    const entry = data.get(key);
    return typeof entry === 'string' ? entry.trim() : '';
  };
  const optional = (key: string) => value(key) || null;
  return {
    title: value('title'),
    slug: value('slug'),
    summary: optional('summary'),
    description: optional('description'),
  };
};
function Form({
  initial,
  label,
  busy,
  submit,
}: {
  initial?: GroupingTextInput;
  label: string;
  busy: boolean;
  submit: TextCommand;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent>
      <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(text(event.currentTarget));
      }}
    >
      <FormField>
        <FieldLabel htmlFor={`${label}-title`}>عنوان</FieldLabel>
        <Input
          defaultValue={initial?.title}
          name="title"
          id={`${label}-title`}
          required
        />
      </FormField>
      <FormField>
        <FieldLabel htmlFor={`${label}-slug`}>نامک</FieldLabel>
        <Input
          defaultValue={initial?.slug}
          dir="ltr"
          name="slug"
          id={`${label}-slug`}
          required
        />
      </FormField>
      <FormField>
        <FieldLabel htmlFor={`${label}-summary`}>خلاصه</FieldLabel>
        <Input
          defaultValue={initial?.summary ?? ''}
          name="summary"
          id={`${label}-summary`}
        />
      </FormField>
      <FormField>
        <FieldLabel htmlFor={`${label}-description`}>توضیحات</FieldLabel>
        <Textarea
          defaultValue={initial?.description ?? ''}
          name="description"
          id={`${label}-description`}
        />
      </FormField>
      <div className="flex justify-end">
        <Button disabled={busy} type="submit">
          <Save aria-hidden="true" />
          {busy ? 'در حال ذخیره…' : label}
        </Button>
      </div>
      </form>
      </CardContent>
    </Card>
  );
}
function ErrorMessage({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  const message =
    isAdminApiError(error) && error.problem.kind === 'api'
      ? error.problem.status === 409
        ? 'اطلاعات هم‌زمان تغییر کرده است. صفحه را تازه‌سازی کنید.'
        : error.problem.detail
      : 'عملیات انجام نشد. دوباره تلاش کنید.';
  return (
    <section className="space-y-3" role="alert">
      <p className="text-sm text-destructive">{message}</p>
      {retry ? (
        <Button onClick={retry} size="sm" variant="outline">
          تلاش دوباره
        </Button>
      ) : null}
    </section>
  );
}
function Loading() {
  return (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}

export function CategoriesRoute() {
  return (
    <PermissionBoundary required={adminRoutes.categories.permissions}>
      <Categories />
    </PermissionBoundary>
  );
}
function Categories() {
  const session = useAdminSession();
  const client = useQueryClient();
  const data = useQuery(categoriesQuery());
  const create = useMutation(createCategoryMutation());
  const update = useMutation(updateCategoryMutation());
  const move = useMutation(moveCategoryMutation());
  const transition = useMutation(transitionCategoryMutation());
  const [selected, setSelected] = useState<AdminCategory>();
  const canWrite = hasPermission(
    session.permissions,
    'catalog.categories.write',
  );
  const busy =
    create.isPending ||
    update.isPending ||
    move.isPending ||
    transition.isPending;
  const refresh = () =>
    client.invalidateQueries({ queryKey: catalogNavigationKeys.categories() });
  if (data.isPending) return <Loading />;
  if (data.isError)
    return (
      <ErrorMessage error={data.error} retry={() => void data.refetch()} />
    );
  const categories = data.data.items;
  const error = create.error ?? update.error ?? move.error ?? transition.error;
  return (
    <section className="mx-auto max-w-6xl space-y-5" dir="rtl">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-.025em]">
          دسته‌بندی‌ها
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ساختار ناوبری فروشگاه را با ترتیب روشن و قابل‌دسترسی مدیریت کنید.
        </p>
      </header>
      <ErrorMessage error={error} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="grid gap-2 md:hidden">
            {categories.map((category) => (
              <button className="flex items-center justify-between gap-3 rounded-lg bg-card p-4 text-right ring-1 ring-foreground/10" key={category.id} onClick={() => setSelected(category)} type="button">
                <span className="min-w-0"><span className="block truncate font-medium">{category.title}</span><span className="block truncate text-xs text-muted-foreground" dir="ltr">{category.slug}</span></span>
                <StatusBadge tone={category.status === 'active' ? 'success' : 'neutral'}>{category.status === 'active' ? 'فعال' : 'بایگانی'}</StatusBadge>
              </button>
            ))}
          </div>
          <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">عنوان</TableHead>
                <TableHead scope="col">نامک</TableHead>
                <TableHead scope="col">وضعیت</TableHead>
                <TableHead scope="col"><span className="sr-only">عملیات</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow
                  className={
                    selected?.id === category.id
                      ? 'bg-muted/45'
                      : 'hover:bg-muted/25'
                  }
                  key={category.id}
                >
                  <TableCell className="font-medium">{category.title}</TableCell>
                  <TableCell>
                    <bdi dir="ltr">{category.slug}</bdi>
                  </TableCell>
                  <TableCell><StatusBadge tone={category.status === 'active' ? 'success' : 'neutral'}>{category.status === 'active' ? 'فعال' : 'بایگانی'}</StatusBadge></TableCell>
                  <TableCell className="text-left">
                    <Button
                      onClick={() => setSelected(category)}
                      size="sm"
                      variant="ghost"
                    >
                      مدیریت
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </CardContent>
          </Card>
          {!categories.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              هنوز دسته‌بندی ثبت نشده است.
            </p>
          ) : null}
        </div>
        {canWrite ? (
          <Form
            label="ایجاد دسته‌بندی"
            busy={busy}
            submit={async (value) => {
              await create.mutateAsync({
                ...value,
                position: categories.filter((item) => item.parentId === null)
                  .length,
              });
              await refresh();
            }}
          />
        ) : null}
      </div>
      {selected ? (
        <CategoryPanel
          key={selected.id}
          category={selected}
          all={categories}
          busy={busy}
          canWrite={canWrite}
          close={() => setSelected(undefined)}
          refresh={refresh}
          update={async (value) => {
            await update.mutateAsync({
              id: selected.id,
              expectedVersion: selected.version,
              ...value,
            });
          }}
          move={async (parentId, position) => {
            await move.mutateAsync({
              id: selected.id,
              expectedVersion: selected.version,
              parentId,
              position,
            });
          }}
          transition={async () => {
            await transition.mutateAsync({
              id: selected.id,
              expectedVersion: selected.version,
              action: selected.status === 'active' ? 'archive' : 'restore',
            });
          }}
        />
      ) : null}
    </section>
  );
}
function CategoryPanel({
  category,
  all,
  busy,
  canWrite,
  close,
  refresh,
  update,
  move,
  transition,
}: {
  category: AdminCategory;
  all: AdminCategory[];
  busy: boolean;
  canWrite: boolean;
  close: () => void;
  refresh: () => Promise<void>;
  update: TextCommand;
  move: (parentId: string | null, position: number) => Promise<void>;
  transition: () => Promise<void>;
}) {
  const [parentId, setParentId] = useState(category.parentId ?? '');
  const siblings = all
    .filter((item) => item.parentId === category.parentId)
    .sort((a, b) => a.position - b.position);
  const index = siblings.findIndex((item) => item.id === category.id);
  const descendants = new Set<string>();
  let parents = [category.id];
  while (parents.length) {
    const children = all.filter((item) =>
      parents.includes(item.parentId ?? ''),
    );
    children.forEach((item) => descendants.add(item.id));
    parents = children.map((item) => item.id);
  }
  const possibleParents = all.filter(
    (item) =>
      item.status === 'active' &&
      item.id !== category.id &&
      !descendants.has(item.id),
  );
  const targetSiblingCount = all.filter(
    (item) => item.parentId === (parentId || null) && item.id !== category.id,
  ).length;
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">مدیریت «{category.title}»</h2>
        <Button onClick={close} size="sm" variant="ghost">
          بستن
        </Button>
      </div>
      {canWrite ? (
        <Form
          initial={category}
          label="ذخیره تغییرات"
          busy={busy}
          submit={async (value) => {
            await update(value);
            await refresh();
          }}
        />
      ) : null}
      {canWrite ? (
        <section className="space-y-2 border-t border-border pt-4">
          <label className="block text-sm font-medium">
            دستهٔ والد
            <select
              className="catalog-input mt-1"
              disabled={busy}
              onChange={(event) => setParentId(event.target.value)}
              value={parentId}
            >
              <option value="">بدون والد (دستهٔ اصلی)</option>
              {possibleParents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || parentId === (category.parentId ?? '')}
            onClick={() =>
              void move(parentId || null, targetSiblingCount).then(refresh)
            }
            size="sm"
            variant="outline"
          >
            انتقال به دستهٔ انتخاب‌شده
          </Button>
        </section>
      ) : null}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || index === 0}
            onClick={() =>
              void move(category.parentId, index - 1).then(refresh)
            }
            size="sm"
            variant="outline"
          >
            <ArrowUp aria-hidden="true" /> بالاتر
          </Button>
          <Button
            disabled={busy || index === siblings.length - 1}
            onClick={() =>
              void move(category.parentId, index + 1).then(refresh)
            }
            size="sm"
            variant="outline"
          >
            <ArrowDown aria-hidden="true" /> پایین‌تر
          </Button>
          <Button
            className={
              category.status === 'active' ? 'text-destructive' : undefined
            }
            disabled={busy}
            onClick={() => void transition().then(refresh)}
            size="sm"
            variant="outline"
          >
            {category.status === 'active' ? (
              <Archive aria-hidden="true" />
            ) : (
              <RotateCcw aria-hidden="true" />
            )}
            {category.status === 'active' ? 'بایگانی' : 'بازیابی'}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function CollectionsRoute() {
  return (
    <PermissionBoundary required={adminRoutes.collections.permissions}>
      <Collections />
    </PermissionBoundary>
  );
}
function Collections() {
  const session = useAdminSession();
  const client = useQueryClient();
  const data = useQuery(collectionsQuery());
  const create = useMutation(createCollectionMutation());
  const update = useMutation(updateCollectionMutation());
  const replace = useMutation(productsCollectionMutation());
  const transition = useMutation(transitionCollectionMutation());
  const [selected, setSelected] = useState<AdminCollection>();
  const canWrite = hasPermission(
    session.permissions,
    'catalog.collections.write',
  );
  const busy =
    create.isPending ||
    update.isPending ||
    replace.isPending ||
    transition.isPending;
  const refresh = () =>
    client.invalidateQueries({ queryKey: catalogNavigationKeys.collections() });
  if (data.isPending) return <Loading />;
  if (data.isError)
    return (
      <ErrorMessage error={data.error} retry={() => void data.refetch()} />
    );
  const error =
    create.error ?? update.error ?? replace.error ?? transition.error;
  return (
    <section className="mx-auto max-w-6xl space-y-5" dir="rtl">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-.025em]">مجموعه‌ها</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          کالاهای منتخب را با ترتیب مشخص برای ویترین فروشگاه آماده کنید.
        </p>
      </header>
      <ErrorMessage error={error} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="grid gap-2 md:hidden">
            {data.data.items.map((collection) => (
              <button className="flex items-center justify-between gap-3 rounded-lg bg-card p-4 text-right ring-1 ring-foreground/10" key={collection.id} onClick={() => setSelected(collection)} type="button">
                <span className="min-w-0"><span className="block truncate font-medium">{collection.title}</span><span className="block text-xs text-muted-foreground">{collection.products.length.toLocaleString('fa-IR')} کالا</span></span>
                <StatusBadge tone={collection.status === 'active' ? 'success' : 'neutral'}>{collection.status === 'active' ? 'فعال' : 'بایگانی'}</StatusBadge>
              </button>
            ))}
          </div>
          <Card className="hidden overflow-hidden md:block">
          <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">عنوان</TableHead>
                <TableHead scope="col">کالاها</TableHead>
                <TableHead scope="col"><span className="sr-only">عملیات</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.items.map((collection) => (
                <TableRow
                  className={
                    selected?.id === collection.id
                      ? 'bg-muted/45'
                      : 'hover:bg-muted/25'
                  }
                  key={collection.id}
                >
                  <TableCell className="font-medium">{collection.title}</TableCell>
                  <TableCell>
                    {collection.products.length.toLocaleString('fa-IR')}
                  </TableCell>
                  <TableCell className="text-left">
                    <Button
                      onClick={() => setSelected(collection)}
                      size="sm"
                      variant="ghost"
                    >
                      مدیریت
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </CardContent>
          </Card>
          {!data.data.items.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              هنوز مجموعه‌ای ثبت نشده است.
            </p>
          ) : null}
        </div>
        {canWrite ? (
          <Form
            label="ایجاد مجموعه"
            busy={busy}
            submit={async (value) => {
              await create.mutateAsync(value);
              await refresh();
            }}
          />
        ) : null}
      </div>
      {selected ? (
        <CollectionPanel
          collection={selected}
          busy={busy}
          canWrite={canWrite}
          close={() => setSelected(undefined)}
          refresh={refresh}
          update={async (value) => {
            await update.mutateAsync({
              id: selected.id,
              expectedVersion: selected.version,
              ...value,
            });
          }}
          replace={async (items) => {
            await replace.mutateAsync({
              id: selected.id,
              expectedVersion: selected.version,
              items,
            });
          }}
          transition={async () => {
            await transition.mutateAsync({
              id: selected.id,
              expectedVersion: selected.version,
              action: selected.status === 'active' ? 'archive' : 'restore',
            });
          }}
        />
      ) : null}
    </section>
  );
}
function CollectionPanel({
  collection,
  busy,
  canWrite,
  close,
  refresh,
  update,
  replace,
  transition,
}: {
  collection: AdminCollection;
  busy: boolean;
  canWrite: boolean;
  close: () => void;
  refresh: () => Promise<void>;
  update: TextCommand;
  replace: (items: { productId: string; position: number }[]) => Promise<void>;
  transition: () => Promise<void>;
}) {
  const [ids, setIds] = useState(
    collection.products.map((item) => item.productId),
  );
  const [query, setQuery] = useState('');
  const products = useQuery(
    adminProductsListQueryOptions({ q: query, limit: 10 }),
  );
  const move = (index: number, direction: -1 | 1) =>
    setIds((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">مدیریت «{collection.title}»</h2>
        <Button onClick={close} size="sm" variant="ghost">
          بستن
        </Button>
      </div>
      {canWrite ? (
        <Form
          initial={collection}
          label="ذخیره تغییرات"
          busy={busy}
          submit={async (value) => {
            await update(value);
            await refresh();
          }}
        />
      ) : null}
      {canWrite ? (
        <section className="space-y-3 border-t pt-5">
          <h3 className="font-semibold">کالاهای مجموعه</h3>
          <input
            className="catalog-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجوی کالا"
            value={query}
          />
          {products.data?.items.map((product: AdminProductSummary) => (
            <div
              className="flex justify-between border-b py-2 text-sm"
              key={product.id}
            >
              <span>{product.title}</span>
              <Button
                disabled={ids.includes(product.id)}
                onClick={() => setIds((current) => [...current, product.id])}
                size="sm"
                variant="outline"
              >
                <FolderPlus aria-hidden="true" /> افزودن
              </Button>
            </div>
          ))}
          <ol className="divide-y rounded-md border">
            {ids.map((id, index) => (
              <li
                className="flex items-center justify-between gap-2 p-3"
                key={id}
              >
                <bdi className="text-xs" dir="ltr">
                  {id}
                </bdi>
                <span className="flex gap-1">
                  <Button
                    aria-label="بالا"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                    size="sm"
                    variant="ghost"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label="پایین"
                    disabled={busy || index === ids.length - 1}
                    onClick={() => move(index, 1)}
                    size="sm"
                    variant="ghost"
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      setIds((current) => current.filter((item) => item !== id))
                    }
                    size="sm"
                    variant="ghost"
                  >
                    حذف
                  </Button>
                </span>
              </li>
            ))}
          </ol>
          <Button
            disabled={busy}
            onClick={() =>
              void replace(
                ids.map((productId, position) => ({ productId, position })),
              ).then(refresh)
            }
          >
            <Save aria-hidden="true" /> ذخیره ترتیب کالاها
          </Button>
        </section>
      ) : null}
      {canWrite ? (
        <Button
          className={
            collection.status === 'active' ? 'text-destructive' : undefined
          }
          disabled={busy}
          onClick={() => void transition().then(refresh)}
          size="sm"
          variant="outline"
        >
          {collection.status === 'active' ? (
            <Archive aria-hidden="true" />
          ) : (
            <RotateCcw aria-hidden="true" />
          )}
          {collection.status === 'active' ? 'بایگانی' : 'بازیابی'}
        </Button>
      ) : null}
    </section>
  );
}
