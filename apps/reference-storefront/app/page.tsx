import { Suspense } from 'react';
import { ProductGrid } from '../components/product-grid';
import { CategoryNavigation } from '../components/category-navigation';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">مرجع Better Commerce</p>
        <h1>فروشگاهی که محتوا و ظاهرش متعلق به خود شماست</h1>
        <p>
          این متن محتوای ثابتِ کد است؛ در دیتابیس پلتفرم نگهداری نمی‌شود.
        </p>
      </section>

      <section className="catalog-section">
        <Suspense fallback={null}>
          <CategoryNavigation />
        </Suspense>
        <h2>محصولات</h2>
        <Suspense fallback={<ProductGridFallback />}>
          <ProductGrid />
        </Suspense>
      </section>
    </main>
  );
}

function ProductGridFallback() {
  return <p aria-busy="true">در حال دریافت محصولات…</p>;
}
