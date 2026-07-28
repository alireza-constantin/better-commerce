import { notFound, redirect } from 'next/navigation';
import { StorefrontApiError } from '@better-commerce/storefront-core';
import {
  displayAvailability,
  displayMoney,
  displayPriceRange,
} from '../../../lib/commerce-display';
import { getStorefrontServer } from '../../../lib/storefront';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;

  try {
    const detail = await getStorefrontServer().getPublicProduct(slug);

    if (!detail.requestedSlugIsCanonical) {
      redirect(`/products/${detail.canonicalSlug}`);
    }

    return (
      <main className="product-page">
        <a href="/">بازگشت به محصولات</a>
        <h1>{detail.product.title}</h1>
        {detail.product.description ? <p>{detail.product.description}</p> : null}
        <p className="product-price">
          {displayPriceRange(detail.product.priceRange)}
        </p>
        <p>{displayAvailability(detail.product.availability)}</p>
        <p>تعداد مدل‌ها: {detail.product.variantCount}</p>
        <ul className="variant-list">
          {detail.product.variants.map((variant) => (
            <li key={variant.id}>
              <span>{variant.title ?? 'مدل اصلی'}</span>
              <span>{variant.price ? displayMoney(variant.price) : 'بدون قیمت'}</span>
              <span>{displayAvailability(variant.availability)}</span>
            </li>
          ))}
        </ul>
      </main>
    );
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) notFound();
    throw error;
  }
}
