# @better-commerce/storefront-core

Framework-neutral integration behavior for Better Commerce storefronts. It is
not a UI library and does not depend on React, Next.js, Astro, or a router.

## Server catalog reads

Create one facade per incoming server request. Its `signal` can be the
renderer's request-abort signal. Public catalog reads return data plus cache-key
metadata; the selected renderer owns concrete cache and revalidation settings.
Product projections include exact decimal Money strings and conservative
availability. Do not convert Money amounts to JavaScript `number`; format the
string for presentation and let Checkout revalidate the authoritative result.
They also include ordered image URLs, intrinsic dimensions, media type, and
merchant-authored alt text. The consuming storefront chooses its native or
framework image component.

```ts
import { createStorefrontServer } from '@better-commerce/storefront-core/server';

const storefront = createStorefrontServer({
  baseUrl: 'http://api:3000',
  signal: incomingRequest.signal,
});

const products = await storefront.listPublicProducts({ limit: 12 });
```

Never put a request-scoped facade, cookies, customer data, or personalized
responses in a global singleton or shared cache.

Public Catalog reads accept no inbound header collection. A future
personalized server facade must define a narrow allowlist rather than forward
request headers wholesale.

Browser session, CSRF, persistent Cart, customer Order, and checkout integration
are available through `@better-commerce/storefront-core/browser`.

## Browser session and checkout

The browser entry point owns credentialed session transport, in-memory CSRF
state, normalized UI-safe errors, customer Order reads, and checkout
idempotency. It does not import React, a router, or a state library.

```ts
import { createStorefrontBrowser } from '@better-commerce/storefront-core/browser';

const storefront = createStorefrontBrowser();
await storefront.cart.getCurrent();
await storefront.cart.setQuantity(variantId, 2);
const customer = await storefront.session.login({ email, password });

const cart = storefront.cart.getSnapshot();
if (!cart.id) throw new Error('Cart is empty');
const preparation = await storefront.cart.prepareCheckout(deliveryAddress);
const shippingMethodId = preparation.shippingMethods[0]?.methodId;
if (!shippingMethodId) throw new Error('No eligible Shipping method');
const submission = storefront.checkout.createSubmission({
  cartId: cart.id,
  cartVersion: cart.version,
  shippingMethodId,
  paymentMethod: 'cash_on_delivery',
  deliveryAddress,
});
try {
  const order = await submission.submit();
} catch {
  // If the result is uncertain, retry this same submission object. It retains
  // the exact request body and Idempotency-Key.
  const order = await submission.submit();
}
```

CSRF tokens exist in memory only. The package retries exactly once only after
an API `403` with code `security.csrf_invalid`; it never replays generic
authorization failures. Login, logout, password changes, and session loss
invalidate CSRF state.

A checkout submission coalesces concurrent calls, preserves its key and body
across explicit retries, caches a completed response, and rejects reuse after
the authenticated customer changes. Network failures are not automatically
retried because their outcome may be uncertain.

Cart state is authoritative in PostgreSQL. The browser package keeps only a
current projection, sends absolute quantities with the observed Cart version,
and refreshes after `cart.version_conflict` without replaying the rejected
intent. Login and registration claim the anonymous HttpOnly-cookie Cart through
the Cart API. The package never stores Cart authority in localStorage.

Checkout preparation derives the current merchandise subtotal, eligible Shipping
methods with exact grand totals, and permitted manual payment methods from
authoritative Cart, Catalog, Pricing, Inventory, Shipping, and Payments data.
It is ephemeral: it does not save the delivery address or selections. Final
checkout revalidates every input atomically.
