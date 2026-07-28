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
        |     session lifecycle, CSRF, customer Orders, checkout idempotency
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

There is currently no Cart module or HTTP contract. Storefront-core therefore
does not claim persistent Cart synchronization and does not store a supposed
platform Cart in `localStorage`.

Before Cart implementation, a focused ADR must decide:

- anonymous ownership and identifier lifetime;
- authenticated ownership;
- login and registration merge behavior;
- expiry and cleanup;
- optimistic concurrency and conflicting device updates;
- quantity limits and normalization;
- whether and how anonymous Cart state survives browser restarts.

The Cart remains mutable purchase intent. Adding a line never reserves stock,
and checkout always revalidates Product eligibility, Price, Inventory,
Shipping, and payment method.

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
