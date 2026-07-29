# Storefront Integration

Status: Living document  
Last verified: 2026-07-28

## Purpose

This document describes the implemented framework-neutral storefront runtime
boundary. ADR-0011 owns the decision; this document records the current source
shape and behavior.

## Runtime layers

```text
merchant or reference storefront
  presentation, routes, renderer cache, UI state
        |
        +-- @better-commerce/storefront-core/server
        |     public Catalog reads, exact display Money, cancellation,
        |     normalized server failures, cache-key metadata
        |
        +-- @better-commerce/storefront-core/browser
        |     session lifecycle, CSRF, persistent Cart, customer Orders,
        |     checkout idempotency
        |
        +-- @better-commerce/sdk
              generated HTTP contract and environment-specific clients
```

Neither storefront-core entry point imports React, Next.js, Astro, a router, or
a global state library. Renderer adapters and UI state remain local to each
storefront.

## Browser protocol invariants

- Browser requests always use credentialed same-origin transport.
- The HttpOnly session cookie is never read by JavaScript.
- CSRF tokens are coalesced and retained only in memory.
- Session rotation or loss invalidates the current CSRF generation.
- Only `403 security.csrf_invalid` permits one mutation replay with a newly
  acquired token.
- Generic `403`, validation, authorization, and network failures are not
  automatically replayed.
- A checkout submission owns one immutable serialized input and one
  `Idempotency-Key`.
- Concurrent submission calls coalesce; uncertain outcomes are retried only by
  explicitly calling the same submission again.
- A completed submission returns its captured Order without another mutation.
- A submission cannot cross an authenticated-customer identity change.
- UI-safe fallback messages are Persian while structured API problem metadata
  remains available for diagnostics and field mapping.

## Cart boundary

ADR-0015 is implemented through the PostgreSQL Cart module and
`storefront-core/browser`. Anonymous ownership uses a high-entropy HttpOnly
cookie whose keyed digest is stored in PostgreSQL. Login and registration
explicitly claim or merge that Cart. Authenticated customers have one active
Cart across devices.

Every mutation carries the observed version. Storefront-core refreshes after a
version conflict but does not replay the rejected intent. Cart display lines
compose current Catalog, Pricing, and Inventory projections; persisted lines
contain only Variant ID and requested quantity.

Checkout preparation composes the current Cart and delivery address with the
Shipping contract to expose only eligible methods and exact charges. It does
not persist the address or selection. The reference storefront uses this
projection for its Shipping selector rather than accepting an opaque UUID.

The Cart remains mutable purchase intent. Adding a line never reserves stock.
Cart checkout is authenticated and atomically revalidates Product eligibility,
Price, Inventory, Shipping, and payment method before closing the Cart.

## Verification

`packages/storefront-core/scripts/verify.mjs` builds the package, compiles clean
server and browser consumers, and checks:

- explicit server/browser package entry points;
- no server imports in the browser entry and no browser imports in the server
  entry;
- no Next.js, React, or Node runtime dependency in browser output;
- request cancellation for server reads;
- exact public Money and availability mapping;
- CSRF invalidation and exactly-one retry;
- stable checkout key and body across CSRF and uncertain-result retries;
- completed-call coalescing;
- customer-session binding;
- browser credential inclusion.
- anonymous Cart creation and authenticated claim;
- Cart-version conflict refresh without mutation replay;
- checkout preparation and eligible Shipping-method typing;
- Cart-based checkout request typing.
