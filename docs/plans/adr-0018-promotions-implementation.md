# ADR-0018 Promotions and Discounts Implementation Plan

Status: planned
ADR: [ADR-0018](../adr/0018-promotions-and-discounts.md)
Contract: [Promotions and Discounts](../contracts/promotions.md)

## Goal

Add one authoritative Promotions module that can define, quote, and atomically
redeem a bounded v1 discount while preserving exact Money, Cart, Checkout,
Order, Inventory, Pricing, and audit boundaries.

## Phase 1 — Domain and persistence

- Add Promotion definitions, immutable definition versions, lifecycle state,
  targets, codes, and redemption records.
- Enforce normalized-code uniqueness, schedule rules, target limits, and
  optimistic versions.
- Add exact percentage/fixed allocation services using ADR-0007 Money.
- Add public module contracts and focused unit/property tests.

Exit condition: domain rules and concurrent redemption persistence work without
HTTP, SDK, Admin, or storefront dependencies.

## Phase 2 — Administrative HTTP API

- Add permission catalogue entries and role grants for `promotions.read` and
  `promotions.write`.
- Add cursor-paginated list/detail/create/definition/lifecycle/redemption
  endpoints.
- Add problem details, CSRF/origin enforcement, audit events, OpenAPI DTOs,
  and API contract tests.

Exit condition: staff can manage a Promotion through documented typed HTTP
routes with version conflicts and safe failures.

## Phase 3 — Checkout integration

- Extend checkout preparation and cart-order input with optional
  `promotionCode`.
- Quote Promotions after fresh Catalog and Pricing reads.
- Include the exact discount in checkout totals and immutable Order snapshots.
- Claim redemption limits in the existing checkout transaction.
- Preserve idempotent replay and full rollback across Cart, Order, Payment,
  Inventory, and Promotions.

Exit condition: no successful Order can bypass promotion eligibility, limits,
or exact allocation, and retries cannot double-redeem.

## Phase 4 — Generated SDK and storefront-core

- Regenerate the SDK from OpenAPI.
- Add framework-neutral promotion quote and typed failure models.
- Add checkout-preparation and checkout submission support for an optional
  code without persisting authoritative promotion state in Cart.
- Keep browser error recovery and CSRF behavior consistent with existing Cart
  flows.

Exit condition: a clean TypeScript consumer can display and submit a promotion
code without importing API internals or calculating discounts locally.

## Phase 5 — Admin workflow

- Add a searchable Persian RTL Promotions workspace.
- Add guided rule, target, schedule, code, priority, and usage-limit forms.
- Show exact configured currency and redemption history.
- Require confirmation for pause, end, and high-impact limit changes.
- Handle `403`, `409`, and validation errors with non-technical recovery copy.

Exit condition: authorized staff can create and operate campaigns without raw
UUID or JSON workflows, and history remains explainable.

## Phase 6 — Verification and documentation

- Run concurrency tests for two checkouts competing for the last redemption.
- Run idempotency, rollback, stale-version, and cross-customer security tests.
- Verify OpenAPI/SDK drift, Admin browser flows, responsive RTL behavior, and
  accessibility.
- Update module maps, commerce audit action lists, external API docs, and the
  living implementation status.

Exit condition: every ADR invariant has executable coverage and the repository
checks pass without changing unrelated dirty worktree files.

