import type { ReactNode } from 'react';
import type {
  StorefrontMoney,
  StorefrontProductListItem,
} from '@better-commerce/storefront-core';

export interface ProductGridProps {
  readonly products: readonly StorefrontProductListItem[];
  readonly emptyMessage?: ReactNode;
  readonly productHref?: (product: StorefrontProductListItem) => string;
  readonly renderLink?: (input: {
    readonly href: string;
    readonly children: ReactNode;
  }) => ReactNode;
}

/**
 * Portable React presentation source. This file intentionally owns no fetch,
 * session, cart, checkout, route, or framework-cache behavior.
 */
export function ProductGrid({
  products,
  emptyMessage = 'محصولی برای نمایش وجود ندارد.',
  productHref = (product) => `/products/${product.slug}`,
  renderLink = ({ href, children }) => <a href={href}>{children}</a>,
}: ProductGridProps) {
  if (products.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <ul className="bc-product-grid">
      {products.map((product) => {
        const href = productHref(product);
        const image = product.media[0];

        return (
          <li key={product.id}>
            <article className="bc-product-card">
              {image
                ? renderLink({
                    href,
                    children: (
                      <img
                        alt={image.altText}
                        className="bc-product-card__image"
                        decoding="async"
                        height={image.height}
                        loading="lazy"
                        src={image.url}
                        width={image.width}
                      />
                    ),
                  })
                : <div aria-hidden="true" className="bc-product-card__placeholder" />}
              <h2 className="bc-product-card__title">
                {renderLink({ href, children: product.title })}
              </h2>
              {product.summary ? <p>{product.summary}</p> : null}
              <p className="bc-product-card__price">
                {displayPriceRange(product.priceRange)}
              </p>
              <small>{displayAvailability(product.availability)}</small>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function displayPriceRange(
  range: StorefrontProductListItem['priceRange'],
): string {
  if (!range) return 'قیمت ثبت نشده است';
  if (!range.varies) return displayMoney(range.minimum);
  return `از ${displayMoney(range.minimum)} تا ${displayMoney(range.maximum)}`;
}

function displayMoney(money: StorefrontMoney): string {
  return money.currency === 'IRR'
    ? `${money.amount} ریال`
    : `${money.amount} ${money.currency}`;
}

function displayAvailability(
  availability: StorefrontProductListItem['availability'],
): string {
  return {
    in_stock: 'موجود',
    out_of_stock: 'ناموجود',
    unavailable: 'فعلاً قابل سفارش نیست',
  }[availability];
}
