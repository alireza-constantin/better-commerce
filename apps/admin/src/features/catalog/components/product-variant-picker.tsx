import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import {
  adminProductDetailQueryOptions,
  adminProductsListQueryOptions,
} from '../api';

export function ProductVariantPicker({
  onChange,
  value,
}: {
  readonly onChange: (variantId: string) => void;
  readonly value: string;
}) {
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const products = useQuery(
    adminProductsListQueryOptions({ limit: 10, q: deferredSearch || undefined }),
  );
  const product = useQuery({
    ...adminProductDetailQueryOptions(productId),
    enabled: Boolean(productId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>انتخاب کالا و گونه</CardTitle>
        <CardDescription>به‌جای شناسه فنی، ابتدا کالا و سپس گونه موردنظر را انتخاب کنید.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="text-sm font-medium" htmlFor="operation-product-search">جست‌وجوی کالا</label>
          <Input
            className="mt-2"
            id="operation-product-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="نام یا نامک کالا"
            value={search}
          />
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
            {products.isPending ? (
              <div className="space-y-2 p-3"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
            ) : products.data?.items.length ? (
              <ul className="divide-y divide-border">
                {products.data.items.map((item) => (
                  <li key={item.id}>
                    <button
                      aria-pressed={item.id === productId}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-right outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[selected=true]:bg-primary/8"
                      data-selected={item.id === productId}
                      onClick={() => { setProductId(item.id); onChange(''); }}
                      type="button"
                    >
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground" dir="ltr">{item.slug}</span></span>
                      <StatusBadge tone={item.status === 'published' ? 'success' : 'neutral'}>{item.status === 'published' ? 'منتشرشده' : item.status === 'draft' ? 'پیش‌نویس' : 'بایگانی'}</StatusBadge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="p-6 text-center text-sm text-muted-foreground">کالایی پیدا نشد.</p>}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">گونه‌های کالا</p>
          <div className="mt-2 min-h-40 rounded-lg ring-1 ring-foreground/10">
            {!productId ? (
              <div className="flex min-h-40 flex-col items-center justify-center p-5 text-center text-sm text-muted-foreground"><PackageSearch aria-hidden="true" className="mb-2 size-6" />یک کالا را انتخاب کنید.</div>
            ) : product.isPending ? (
              <div className="space-y-2 p-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : product.data?.variants.length ? (
              <ul className="divide-y divide-border">
                {product.data.variants.map((variant) => (
                  <li key={variant.id}>
                    <button
                      aria-pressed={variant.id === value}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-right outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[selected=true]:bg-primary/8"
                      data-selected={variant.id === value}
                      onClick={() => onChange(variant.id)}
                      type="button"
                    >
                      <span><span className="block text-sm font-medium">{variant.title || 'گونه پیش‌فرض'}</span><span className="block text-xs text-muted-foreground" dir="ltr">{variant.sku || 'بدون کد کالا'}</span></span>
                      <StatusBadge tone={variant.status === 'active' ? 'success' : 'neutral'}>{variant.status === 'active' ? 'فعال' : 'بایگانی'}</StatusBadge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="p-6 text-center text-sm text-muted-foreground">این کالا گونه‌ای ندارد.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
