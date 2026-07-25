# ADR-0008 — Inventory and Reservations

Status: Accepted
Date: 2026-07-25
Accepted: 2026-07-25
Frozen: 2026-07-25

## Context

ADR-0004 assigns Inventory sole authority for stock tracking, stock state,
reservations, releases, adjustments, and oversell protection. Catalog owns
Variant identity and fulfillment classification but deliberately contains no
stock or availability fields. ADR-0006 requires checkout to coordinate
Inventory reservation with accepted Order creation.

Inventory is one of the easiest places to create silent commercial corruption:
two checkouts can both see stock, a cart can reserve indefinitely, a payment
failure can leave stock trapped, an adjustment can erase accountability, or a
Product can expose a fake universal `inStock` flag.

This ADR defines a one-location, whole-unit, no-oversell Inventory model with
durable reservations, immutable adjustment history, and PostgreSQL concurrency
rules. It does not introduce warehouses, purchase orders, suppliers, backorders,
or a generic fulfillment system.

## Decision drivers

- Prevent oversell under concurrent checkout
- Preserve a traceable stock-adjustment history
- Support physical goods now without forcing digital/service stock tracking
- Keep Cart behavior simple: no cart reservations
- Coordinate safely with Orders without cross-module repository access
- Avoid a worker or distributed lock unless a concrete workflow needs one
- Be understandable to a small single-store operation

## Vocabulary

- **Inventory item:** Inventory-owned stock state for one Catalog Variant.
- **Tracked Variant:** a Variant for which Inventory constrains purchase
  quantity.
- **Untracked Variant:** a Variant for which Inventory is not an eligibility
  constraint.
- **On hand:** physically/accountingly held whole-unit stock owned by
  Inventory.
- **Reserved:** tracked stock temporarily claimed by an active checkout/Order
  reservation.
- **Available:** derived quantity `onHand - activeReserved`; never an
  independently editable column.
- **Reservation:** durable time-bounded claim on tracked Variant quantity.
- **Commit:** turn a valid reservation into consumed stock for an accepted
  Order/payment workflow.
- **Release:** remove a reservation claim without consuming stock.
- **Adjustment:** immutable, attributable change to on-hand stock with a named
  reason.

## Decision

### Inventory is one business module

The API introduces an `inventory` module only with real stock behavior.
Inventory alone owns:

- whether a Variant is tracked or untracked;
- Inventory item state;
- on-hand and reserved quantities;
- reservations, expiry, release, and commitment;
- adjustment ledger entries and reasons;
- concurrency and oversell policy;
- availability projections derived from its own facts.

Inventory references Catalog Variant IDs as scalars and validates an
administrative target through Catalog's Module Public Contract where required.
It does not own Product/Variant lifecycle, price, cart, Order snapshots,
payment attempts, or fulfillment execution.

### Initial stock model

Version 1 supports one logical stock location per store deployment and positive
whole-unit quantities only. Fractional quantities require a future exact
Quantity decision and are not simulated with decimal or floating values.

For every configured tracked Variant, Inventory stores one Inventory item with:

- opaque UUID;
- Variant ID scalar reference, unique within the store;
- tracking mode: `tracked` or `untracked`;
- non-negative integer `onHand`;
- non-negative integer active `reserved` quantity;
- concurrency version;
- UTC created/updated instants.

`available` is always derived as `onHand - reserved`. It is never stored as a
mutable source of truth. A tracked item obeys `reserved <= onHand`.

An untracked Variant is not represented as fake infinite stock. Its availability
result says Inventory imposes no quantity constraint. It may retain an
Inventory item/configuration record, but on-hand/reserved values are neither
used nor exposed as a purchasable inventory quantity.

Inventory does not infer tracking from Catalog fulfillment classification. A
physical made-to-order Variant may be untracked; a digital Variant may later be
tracked for a finite license pool.

### No-oversell policy

Version 1 rejects a tracked reservation or commitment that would make available
stock negative. Backorders, overselling, negative on-hand, and waitlists are
not supported.

The check and mutation occur atomically in PostgreSQL. For multi-Variant
checkout, Inventory processes Variant IDs in deterministic sorted order and
locks/updates the corresponding items in that order. This prevents lock-order
deadlocks and prevents two concurrent requests from reserving the same last
unit.

Read-model availability is advisory. Only the reservation command is
authoritative for checkout eligibility.

### Adjustment ledger

Every on-hand change produces one immutable adjustment ledger entry. An entry
contains:

- opaque UUID;
- Inventory item and Variant ID;
- signed whole-unit delta;
- resulting on-hand quantity;
- named reason code;
- optional safe note/reference;
- actor Identity user ID or system marker;
- UTC created instant.

Initial reason codes are:

- `initial_stock`;
- `manual_correction`;
- `received`;
- `damaged`;
- `reservation_committed`.

Adjustment commands reject a result below zero. A future backorder policy must
be explicit before this invariant changes.

The ledger is append-only. Inventory item values are the current efficient
state; the ledger is the accountable history. An administrative correction adds
an adjustment—it never edits an old entry or directly patches `onHand`.

### Reservation lifecycle

A Reservation has:

- opaque UUID;
- Inventory item/Variant ID;
- positive whole-unit quantity;
- owning checkout/Order correlation reference;
- status: `active`, `released`, `committed`, or `expired`;
- UTC created instant;
- UTC expiry instant;
- nullable terminal instant and safe terminal reason.

Allowed transitions are:

```text
active -> committed
active -> released
active -> expired
```

Terminal reservations never reopen or change quantity.

The initial reservation duration is a validated deployment configuration. A
normal immediate checkout defaults to 30 minutes; manual-review Orders default
to 12 hours. The allowed range is 30 minutes to 24 hours. It starts when
checkout successfully reserves stock. Cart creation never reserves stock.

An active reservation is eligible only while `expiresAt > database current
time`. Before a reserve, release, commit, or availability-changing command for
an Inventory item, Inventory expires that item's stale active reservations in
the same transaction and reduces its active reserved quantity. This makes
expired stock reclaimable without requiring a worker for correctness. A later
background cleanup job may improve hygiene, but it is not an authority or a
requirement for availability.

### Reservation commands and idempotency

Inventory exposes narrow transaction-aware Module Public Contract operations
conceptually equivalent to:

```text
reserve(variantQuantities, checkoutCorrelation, transactionContext)
release(reservationReferences, reason, transactionContext)
commit(reservationReferences, orderId, transactionContext)
getAvailability(variantIds)
```

The reserve input is bounded, deduplicated by Variant ID, and uses positive
integer quantities. A caller cannot reserve the same Variant twice in one
request under different lines.

Reservation correlation is unique for the relevant checkout submission. A
retry with the same correlation and identical quantities returns the original
active/terminal result rather than double-reserving. Reuse with different
Variant quantities conflicts. Checkout's submission idempotency remains owned
by Orders; Inventory owns only the reservation idempotency needed to protect
its own state.

`commit` atomically:

- verifies every Reservation is active and unexpired;
- reduces both `onHand` and active `reserved` by the committed quantity;
- writes `reservation_committed` adjustment entries;
- marks Reservations `committed` with the Order reference.

`release` atomically reduces active reserved quantity and marks Reservations
terminal. It never changes on-hand quantity.

An expired reservation cannot be committed. A later payment success after
expiry requires a named recovery workflow; it cannot consume stock silently.

### Checkout, Orders, and external effects

Checkout validates Catalog, obtains Pricing, reserves tracked Inventory, and
creates the accepted Order inside ADR-0003's opaque shared PostgreSQL
transaction where those operations must commit or roll back together.

If Order creation rolls back, reservation creation rolls back. If reservation
cannot be made, no Order is created. No payment, email, shipping, or other
external call runs inside that transaction.

After the Payments/Fulfillment contracts exist, their named workflows decide
when a Reservation commits or releases. Inventory does not inspect a payment
provider, shipment, or Order repository to decide this.

### Administrative access and availability projections

Inventory administrative access is default-deny with explicit permissions:

- `inventory.read` for inventory state and adjustment history;
- `inventory.adjust` for tracking configuration and append-only adjustments.

Existing authorization permissions with these names remain the authority until
an amendment changes them.

Inventory may expose a read-only availability projection by Variant ID:

- `tracked` with available whole-unit quantity when authorized for quantity;
- `tracked` with purchase eligibility boolean for public/read-model consumers;
- `untracked` without a fake quantity;
- `not_configured` when no tracking policy exists.

Catalog and storefronts may display this projection. It never replaces a fresh
reservation during checkout, and it does not contain price or Order state.

### Cross-module references and deletion

Inventory stores Variant IDs as scalar references. A deliberate restrictive
foreign key may be introduced in persistence only under ADR-0003; it does not
permit Catalog entity traversal or Inventory writes to Catalog.

Catalog Variant archival does not delete Inventory history. A Catalog Variant
must fail checkout eligibility before Inventory reserve is reached. Inventory
items, reservations, and adjustment entries are archived/retained according to
their own lifecycle; no cross-module cascade delete is allowed.

## Explicit non-goals

This decision does not introduce:

- multiple warehouses, bins, lots, serial numbers, suppliers, or purchase
  orders;
- fractional quantities, weight/length units, or unit conversion;
- backorders, negative stock, waitlists, or oversell;
- cart reservations;
- inventory allocation across split shipments;
- automated replenishment;
- payment providers, payment capture, refunds, or chargebacks;
- shipment, digital-delivery, service scheduling, or fulfillment execution;
- a background worker required for reservation correctness;
- external inventory services, Redis stock locks, event bus, outbox, or CQRS;
- Orders, Pricing, Cart, or Checkout implementation in isolation.

## Alternatives considered

### Stock field on Product or Variant

Rejected because Catalog owns identity and merchandising, not inventory
concurrency, adjustment history, or reservations.

### Decrement on-hand only after payment

Rejected because concurrent checkouts could both proceed against the same stock.
Reservations protect the commercial promise before external payment completes.

### Reserve stock when added to Cart

Rejected because abandoned carts create stock hoarding, expiry, and recovery
complexity before a real checkout starts.

### Redis lock as inventory authority

Rejected because PostgreSQL is the authoritative transactional store for
Inventory state. Redis may support unrelated technical concerns but cannot be
the source of stock truth.

### Stored mutable `availableQuantity`

Rejected because it can drift from on-hand and reservations. Availability is a
derived value.

### Worker-only expiry

Rejected because a delayed or unavailable worker must not trap stock. Commands
reclaim expired reservations transactionally; a future worker is only cleanup.

### Optimistic retry without database row locks

Rejected because checkout contention needs one clear atomic no-oversell
operation. Deterministic locking/conditional updates are simpler and provable
in PostgreSQL.

## Consequences

### Positive

- Concurrent checkouts cannot oversell tracked stock.
- Expired holds become reclaimable without a correctness-critical worker.
- Every on-hand change is traceable through an immutable ledger.
- Physical, digital, and service Variants can choose tracking independently.
- Checkout has explicit reservation/commit/release boundaries.

### Negative

- Reservations and ledger entries add tables and transaction tests.
- A payment outcome after reservation expiry needs explicit recovery.
- Version 1 deliberately lacks warehouse and backorder features.
- Availability queries are advisory and must be rechecked at reserve time.

## Architectural invariants

An implementation complies with this decision only if:

1. Inventory alone mutates item state, reservations, and adjustment history.
2. Catalog contains no stock/reservation/availability source of truth.
3. Tracked availability equals on-hand minus non-expired active reservations.
4. Version 1 never permits tracked available stock below zero.
5. Quantities are positive whole integers; fractional values are rejected.
6. Every on-hand change writes one immutable adjustment ledger entry.
7. A Reservation is durable, time-bounded, and has one terminal transition.
8. Expiry is enforced by database time inside Inventory transactions.
9. Cart creation never reserves Inventory.
10. Reservation retry cannot double-reserve; changed correlated input conflicts.
11. Multi-Variant reservation uses deterministic lock order and is atomic.
12. Commit changes on-hand/reserved and writes ledger history atomically.
13. Release changes reserved state but never on-hand.
14. Inventory does not inspect or mutate Payment, Order, Catalog, or
    Fulfillment persistence.
15. No external effect occurs inside the shared reservation/Order transaction.
16. Public availability is a read model and cannot replace checkout reserve.
17. Catalog archival and cross-module deletion never erase Inventory history.
18. No Inventory implementation begins until its behavioral contract and
    concurrency-test matrix are approved.

## Acceptance criteria before implementation

The Inventory contract must define and test:

1. tracking configuration and initial-stock adjustment behavior;
2. no-oversell concurrent reservation for one and multiple Variants;
3. deterministic lock ordering and rollback;
4. reservation expiry using database time;
5. idempotent retry and changed-input conflict;
6. commit/release/expiry state transitions and ledger entries;
7. correction/adjustment permissions, reason validation, and history reads;
8. public/admin availability projection field allow-lists;
9. transaction-aware checkout integration;
10. restrictive cross-module references and no Catalog/Order persistence leak.

## Freeze policy

After acceptance, this ADR is frozen. A normative change to tracking policy,
oversell behavior, reservations, expiry, adjustment history, or transaction
boundaries requires a dated amendment or superseding ADR.

## Related decisions

- ADR-0003 defines sole write authority and opaque transactions.
- ADR-0004 defines Inventory's capability authority and checkout role.
- ADR-0005 defines Catalog Variant identity.
- ADR-0006 defines Orders and cancellation boundaries.
- ADR-0007 defines exact Money and Pricing.
