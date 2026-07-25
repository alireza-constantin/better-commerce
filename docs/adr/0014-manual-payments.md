# ADR-0014 — Manual Payments and Admin Order Acceptance

Status: Accepted
Date: 2026-07-25
Accepted: 2026-07-25
Frozen: 2026-07-25

## Context

The initial store must accept cash, cash on delivery, and manual bank-transfer
orders before an online payment gateway exists. Payment truth must not be
collapsed into Order state, and staff review must not rewrite Order snapshots.

## Decision

Payments is one API business module. Version 1 supports code-owned manual
methods: `cash_on_delivery`, `cash_on_pickup`, and `bank_transfer`. Each Order
has one immutable Payment record with exact expected Money and a separate
payment status:

- `pending_manual_review` for bank transfer;
- `pending_collection` for cash on delivery/pickup;
- `confirmed` when authorized staff record receipt;
- `rejected` when staff reject a manual-payment claim;
- `cancelled` when its Order is cancelled before collection.

Customers submit an Order with one permitted manual method. This creates a
`submitted` Order, an exact expected Payment, Inventory reservations, and
shipping snapshots in one PostgreSQL transaction. Staff review happens through
named commands:

- `confirmManualPayment` records that money was received;
- `acceptOrder` transitions a valid submitted Order to accepted and commits
  Inventory reservations;
- `rejectOrder` cancels the submitted Order and releases reservations.

For bank transfer, acceptance requires confirmed Payment. For cash on delivery
or pickup, staff may accept while the Payment remains `pending_collection`.
Recording manual payment never changes an Order state implicitly; accepting an
Order never fabricates a confirmed Payment.

Payment records retain an append-only status history with staff actor, safe
reference/note, and UTC instant. They never store card numbers, gateway tokens,
bank-account secrets, or uploaded payment proofs in version 1.

Initial permissions are `payments.read`, `payments.manual_confirm`,
`orders.accept`, and `orders.reject`. Owner and Administrator receive all;
Order Manager receives all; Support Agent receives only read access. Existing
Order permissions remain unchanged until the Authorization contract is amended
in the implementation change.

## Non-goals

No gateway, webhook, card processing, refund, chargeback, split payment,
partial payment, payment proof upload, payment provider SDK, or automatic
payment expiry is introduced. Those require a later Payments-provider ADR.

## Invariants

1. Payments alone mutates Payment records and payment history.
2. Orders alone transitions Order lifecycle.
3. A submitted Order, Payment, shipping snapshot, and reservation commit or
   roll back together.
4. Bank-transfer Orders cannot be accepted before manual payment confirmation.
5. Cash-on-delivery/pickup Orders may be accepted while collection is pending.
6. Payment history is append-only and excludes sensitive payment material.
7. No provider/network call occurs in the Checkout transaction.

