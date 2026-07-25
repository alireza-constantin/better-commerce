# Commerce Implementation Status

Status: implementation checkpoint  
Updated: 2026-07-25

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

The API TypeScript typecheck passes at this checkpoint.

## Intentionally deferred

At the user's direction, this wave does not claim production readiness yet.
The following verification remains mandatory before launch:

- unit, integration, concurrency, and full-stack tests;
- security review and negative authorization tests;
- OpenAPI response/detail refinement;
- operational audit events for commerce mutations;
- reservation-expiry worker or scheduled cleanup;
- pagination beyond the bounded first 100 Orders;
- baseline production migration after the disposable-schema design stabilizes.

`synchronize` remains a development convenience only and must remain disabled
in production.
