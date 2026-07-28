import Link from 'next/link';
import { displayAvailability, displayPriceRange } from '../lib/commerce-display';
import { getStorefrontServer } from '../lib/storefront';

/** Server Component. Presentation remains local visible source. */
export async function ProductGrid() {
  const page = await getStorefrontServer().listPublicProducts({ limit: 12 });

  if (page.items.length === 0) return <p>محصولی برای نمایش وجود ندارد.</p>;

  return (
    <ul className="product-grid">
      {page.items.map((product) => (
        <li key={product.id}>
          <article>
            <h3>
              <Link href={`/products/${product.slug}`}>{product.title}</Link>
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
