import Link from 'next/link';
import { displayAvailability, displayPriceRange } from '../lib/commerce-display';
import { getStorefrontServer } from '../lib/storefront';
import type { StorefrontProductListPage } from '@better-commerce/storefront-core';

/** Server Component. Presentation remains local visible source. */
export async function ProductGrid({
  page: suppliedPage,
  emptyMessage,
  categorySlug,
}: {
  readonly page?: StorefrontProductListPage;
  readonly emptyMessage?: string;
  readonly categorySlug?: string;
} = {}) {
  const page = suppliedPage ?? await getStorefrontServer().listPublicProducts({ limit: 12 });

  if (page.items.length === 0)
    return <p>{emptyMessage ?? 'محصولی برای نمایش وجود ندارد.'}</p>;

  return (
    <ul className="product-grid">
      {page.items.map((product) => (
        <li key={product.id}>
          <article>
            {product.media[0] ? (
              <Link href={`/products/${product.slug}${categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ''}`}>
                <img
                  alt={product.media[0].altText}
                  className="product-card-image"
                  decoding="async"
                  height={product.media[0].height}
                  loading="lazy"
                  src={product.media[0].url}
                  width={product.media[0].width}
                />
              </Link>
            ) : (
              <div aria-hidden="true" className="product-image-placeholder" />
            )}
            <h3>
              <Link href={`/products/${product.slug}${categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ''}`}>{product.title}</Link>
            </h3>
            {product.summary ? <p>{product.summary}</p> : null}
            <p className="product-price">{displayPriceRange(product.priceRange)}</p>
            <small>
              {product.variantCount} مدل · {displayAvailability(product.availability)}
            </small>
          </article>
        </li>
      ))}
    </ul>
  );
}
