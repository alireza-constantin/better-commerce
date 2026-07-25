# Cursor Handoff — Orders Design and Implementation Gate

Status: Design handoff only — not implementation-ready
Date: 2026-07-25
Authority: `docs/adr/0006-orders.md`

## Copy this instruction to Cursor

```text
You are working in the Better Commerce API modular monolith.

Read these documents in full before changing any code:

- docs/adr/0003-backend.md
- docs/adr/0004-commerce-model.md
- docs/adr/0005-catalog.md
- docs/adr/0006-orders.md
- docs/contracts/authorization.md
- docs/contracts/catalog.md
- docs/handbook/contributor-workflow.md

Do not implement an Orders module, checkout endpoint, price field, stock field,
payment integration, cart, or placeholder schema yet.

ADR-0006 is accepted. Real Order submission is intentionally blocked until:

1. ADR-0007 defines exact Money and Pricing;
2. ADR-0008 defines Inventory reservations and concurrency;
3. an Orders behavioral contract and a Checkout implementation plan are
   approved.

Your task for now is design review only. Report any conflict between the
implemented Catalog module and ADR-0006. Do not invent missing behavior. Do not
create empty directories or speculative interfaces. Do not edit
docs/plans/continuation.md. Do not create migrations. Do not commit.

When the three prerequisites above are accepted, request the approved combined
Orders/Checkout implementation contract before writing code.
```

## Why Cursor is intentionally gated

Orders must persist exact immutable price/tax/total snapshots and coordinate
stock reservation. Those are not Catalog concerns. Coding it now would force
Cursor to invent Money storage, price selection, or Inventory behavior that
ADR-0007 and ADR-0008 must own.

After the gate is removed, Cursor can implement a complete vertical slice using
the approved contract rather than a temporary Order endpoint that later needs a
rewrite.
