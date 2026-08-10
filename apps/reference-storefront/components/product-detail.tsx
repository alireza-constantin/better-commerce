'use client';

import { useMemo, useState } from 'react';
import type { StorefrontProductDetail } from '@better-commerce/storefront-core';
import { AddToCartButton } from './storefront-shell';
import {
  displayAvailability,
  displayMoney,
  displayPriceRange,
} from '../lib/commerce-display';

export function ProductDetailView({
  detail,
}: {
  readonly detail: StorefrontProductDetail;
}) {
  const variants = detail.product.variants;
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? '');
  const selected =
    variants.find((variant) => variant.id === selectedId) ?? variants[0];
  const hero = useMemo(() => {
    const assignedId = selected?.mediaIds[0];
    return (
      detail.product.media.find((image) => image.id === assignedId) ??
      detail.product.media[0]
    );
  }, [detail.product.media, selected]);

  return (
    <>
      {detail.product.media.length ? (
        <div className="product-gallery">
          {hero ? (
            <img
              alt={hero.altText}
              className="product-gallery__hero"
              decoding="async"
              fetchPriority="high"
              height={hero.height}
              src={hero.url}
              width={hero.width}
            />
          ) : null}
          <div className="product-gallery__all" aria-label="گالری تصاویر">
            {detail.product.media.map((image) => (
              <img
                alt={image.altText}
                decoding="async"
                height={image.height}
                key={image.id}
                loading="lazy"
                src={image.url}
                width={image.width}
              />
            ))}
          </div>
        </div>
      ) : null}
      <h1>{detail.product.title}</h1>
      {detail.product.description ? <p>{detail.product.description}</p> : null}
      <p className="product-price">
        {displayPriceRange(detail.product.priceRange)}
      </p>
      <p>{displayAvailability(detail.product.availability)}</p>
      <p>تعداد مدل‌ها: {detail.product.variantCount}</p>
      <ul className="variant-list">
        {variants.map((variant) => (
          <li key={variant.id}>
            <button
              type="button"
              aria-pressed={variant.id === selected?.id}
              onClick={() => setSelectedId(variant.id)}
            >
              {variant.title ?? 'مدل اصلی'}
            </button>
            <span>
              {variant.price ? displayMoney(variant.price) : 'قیمت توافقی'}
            </span>
            <span>{displayAvailability(variant.availability)}</span>
            {variant.price ? (
              <AddToCartButton
                variantId={variant.id}
                disabled={!variant.purchasable}
              />
            ) : (
              <a href="/contact">تماس برای دریافت قیمت</a>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
