import { createStorefrontServer } from '@better-commerce/storefront-core/server';
import { ProductGrid } from '../../components/better-commerce/product-grid/ProductGrid';

/**
 * Next.js App Router recipe. This is copied source: choose caching, metadata,
 * layout, and route conventions in the merchant repository.
 */
export default async function ProductsPage() {
  const storefront = createStorefrontServer({
    baseUrl:
      process.env.BETTER_COMMERCE_API_URL ?? 'http://127.0.0.1:3000',
  });
  const page = await storefront.listPublicProducts({ limit: 12 });

  return (
    <main>
      <h1>محصولات</h1>
      <ProductGrid products={page.items} />
    </main>
  );
}
