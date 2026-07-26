# Commerce Implementation Status

Status: implementation and verification checkpoint
Updated: 2026-07-26

## Implemented in this wave

- immutable current Price versions and exact minor-unit Money;
- tracked/untracked Inventory, adjustments, expiring reservations, commit, and release;
- configurable Shipping zones, methods, and non-overlapping subtotal rate ranges;
- manual payment records for cash on delivery, cash on pickup, and bank transfer;
- immutable submitted Order and Order-line snapshots;
- customer-scoped order list/detail endpoints;
- idempotent customer checkout submission;
- atomic checkout across price selection, shipping quote, inventory hold, Order,
  lines, and manual payment;
- Admin order list/detail, manual-payment confirmation, acceptance, and
  rejection;
- Admin Pricing, Inventory, and Shipping configuration endpoints;
- explicit Authorization permissions for Pricing, Shipping, Payments, and
  order decisions.

## Verification completed

- API TypeScript typecheck passes;
- ESLint passes with no errors or warnings;
- 25 unit and architecture suites pass: 131 tests;
- 10 complete API end-to-end suites pass: 51 tests;
- the focused commerce integration suite covers concurrent idempotent checkout,
  exact totals, inventory commit/release, bank-transfer confirmation, session
  authentication, CSRF, cross-customer 404 behavior, Admin denial, and
  owner-authorized acceptance, exact-once reservation expiry, append-only audit
  records, failed-mutation rollback, and concurrent Shipping rule protection;
- transaction unwrapping is restricted to module persistence implementations
  in accordance with ADR-0003;
- Money values are bounded to PostgreSQL `bigint`;
- manual-payment HTTP responses contain JSON-safe decimal strings;
- inventory reconfiguration records the correct adjustment delta and cannot
  change tracking mode while stock is reserved.
- expired Inventory reservations are reclaimed automatically in safe,
  configurable PostgreSQL batches;
- successful commerce mutations write append-only, allowlisted audit events in
  the same transaction;
- staff with `audit.read` can inspect bounded commerce-audit pages.
- Order and commerce-audit collections use stable bounded cursor pagination;
- commerce HTTP success and problem representations are described by OpenAPI
  and generated into `@better-commerce/sdk`.

## Remaining before production launch

- baseline production migration after the disposable-schema design stabilizes;
- define the commerce-audit retention and archival policy before production
  launch;
- resolve the PostgreSQL driver's `client.query()` deprecation warning emitted
  by the test application setup before upgrading to `pg` 9.

`synchronize` remains a development convenience only and must remain disabled
in production.
