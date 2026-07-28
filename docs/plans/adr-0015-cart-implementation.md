# ADR-0015 Cart Implementation Plan

Status: ready
ADR: [ADR-0015](../adr/0015-cart.md)

## Goal

Implement the accepted persistent Cart contract in bounded phases while
preserving the existing checkout, authentication, module-ownership, and
storefront-runtime boundaries.

## Phase 1 — Cart domain and persistence

- Add the Cart module, entities, statuses, limits, configuration, and indexes.
- Implement anonymous-token keyed digests without persisting raw tokens.
- Implement expiry, one-active-customer-Cart enforcement, and optimistic
  versions.
- Add the module public contract and focused domain/service tests.

Exit condition: Cart persistence and concurrent mutation rules work without
HTTP, SDK, or storefront dependencies.

## Phase 2 — External Cart API

- Add current-Cart, set-quantity, remove-line, clear, and claim endpoints.
- Add the anonymous HttpOnly cookie lifecycle.
- Apply session, origin, CSRF, ownership, validation, problem-details, and
  idempotency rules.
- Publish exact OpenAPI schemas and API contract tests.

Exit condition: anonymous and authenticated Cart flows work over HTTP with
stable typed failures.

## Phase 3 — Checkout integration

- Change checkout input from browser-supplied lines to Cart ID and version.
- Lock and read Cart through its public contract in the existing transaction.
- Revalidate Catalog, Pricing, Shipping, and Inventory authority.
- Close Cart atomically with Order, Payment, and Inventory changes.
- Preserve checkout idempotent replay after Cart closure.

Exit condition: no successful Order can be created from stale or
browser-authored Cart facts, and transaction rollback leaves Cart active.

## Phase 4 — Generated SDK and storefront-core

- Regenerate the SDK from OpenAPI.
- Add framework-neutral Cart types and browser operations.
- Add Cart subscriptions, login claim coordination, typed conflicts, and
  checkout-from-Cart submission.
- Keep server and browser entry points dependency-safe.

Exit condition: a clean TypeScript consumer can implement Cart without
importing API internals or a UI framework.

## Phase 5 — Reference storefront flow

- Add Persian, RTL Cart controls and Cart page/drawer to the reference
  storefront.
- Add login-to-claim behavior and visible merge/version conflict recovery.
- Add checkout submission from the current Cart.
- Keep presentation source local to the reference storefront.

Exit condition: a customer can build an anonymous Cart, log in, resolve any
conflict, and submit checkout through the reference UI.

## Phase 6 — System verification and documentation

- Test multi-tab and multi-device version conflicts.
- Test concurrent claim, checkout, expiry, uncertain responses, and
  idempotent replay.
- Test token/cookie secrecy, cross-customer isolation, CSRF, and logs.
- Update external contracts, architecture maps, runbooks, and implementation
  status.
- Run API, SDK, storefront-core, reference-storefront, and repository checks.

Exit condition: all ADR invariants have executable coverage and the living
documentation matches the implementation.

## Model allocation

Use GPT-5.6 Terra with medium reasoning for Phases 1, 2, 4, and 5. These phases
need strong repository work but are bounded enough that the balanced model is
appropriate.

Use GPT-5.6 Sol with high reasoning for Phase 3 and the final concurrency and
security review in Phase 6. These are the highest-risk transaction and
correctness boundaries. Routine documentation and mechanical cleanup inside
Phase 6 can return to Terra medium.

Do not run multiple implementation agents against the same files. Parallel
agents are useful only for read-only review or for phases with explicitly
separate ownership.
