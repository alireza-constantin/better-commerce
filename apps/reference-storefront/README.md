# Reference Storefront

This is Better Commerce's executable Next.js App Router reference, not a
merchant storefront template. It proves server-rendered public catalog access
through `@better-commerce/storefront-core/server`; route composition and all
presentation remain local source.
The reference Product list and detail routes show exact public Price and
availability projections without exposing stock quantities or duplicating
commerce rules.
Its interactive Persian RTL Cart uses the framework-neutral browser core.
Checkout preparation renders eligible Shipping methods and exact charges before
the customer submits the Order. Customers can choose a permitted manual payment
method, receive an Order confirmation, and inspect their own Order history.

```bash
pnpm --filter @better-commerce/reference-storefront dev
```

Set `BETTER_COMMERCE_API_URL` to the server-readable API origin when it is not
available on `http://127.0.0.1:3000`. Caching policy and copied presentation
installation are later phases.
