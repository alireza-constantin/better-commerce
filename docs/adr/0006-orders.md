# ADR-0006 — Orders and Historical Purchase State

Status: Accepted
Date: 2026-07-25
Accepted: 2026-07-25
Frozen: 2026-07-25

## Context

ADR-0004 establishes that an Order is the store's durable historical record of
an accepted purchase, not a live view of Catalog, Pricing, Identity, Customer,
Payment, or Fulfillment data. It also requires immutable order-line snapshots,
idempotent order submission, and separate order, payment, and fulfillment
state dimensions.

ADR-0005 now provides Catalog's stable Product and Variant identities and a
narrow Module Public Contract. Catalog intentionally does not own price,
stock, payment, order, or fulfillment state.

Without a focused Orders decision, implementations commonly make one or more
of these mistakes:

- show historical orders by joining live Product and price records;
- use one `status` field for order, payment, and shipping progress;
- reuse a client retry as a second order;
- mutate accepted line data when a Product title, SKU, email, or price changes;
- treat a payment-provider callback as a transaction over PostgreSQL;
- let an Order service edit Inventory or Catalog directly.

This ADR defines what an Order owns, its identity and historical snapshots, its
initial lifecycle, submission idempotency, customer/staff access, cancellation
boundaries, and the relationship to later Pricing, Inventory, Payments, and
Fulfillment decisions. It deliberately does not select Money storage, price
calculation, stock reservation, payment provider behavior, tax calculation,
shipping-address collection, or checkout UI.

## Decision drivers

- Historical orders must remain explainable after current data changes
- A customer retry must not create duplicate commercial obligations
- The state model must support payment and fulfillment independently
- Customers must see only their own orders
- Staff operations need stable human-facing order references
- The first implementation must avoid fake price, tax, and inventory behavior
- One PostgreSQL deployment should retain strong local consistency without
  pretending external providers are transactional
- The design must remain understandable and operable for a small store

## Vocabulary

- **Order:** the immutable commercial record and lifecycle authority created
  when checkout accepts a purchase.
- **Order line:** one purchased Variant and its immutable commercial snapshot.
- **Snapshot:** a copy of facts needed to explain an accepted order, retained
  even when the current source changes.
- **Order number:** an immutable human-facing reference for one Order; it is
  not the primary key.
- **Submission idempotency key:** a client-provided opaque key that binds a
  logically identical order-submission retry to one result.
- **Accepted:** the Order has been created with complete snapshots and
  commercial totals. It may still be unpaid or unfulfilled.
- **Cancellation:** a named reversal workflow that withdraws an accepted Order
  obligation according to the applicable payment, inventory, and fulfillment
  rules.
- **Payment state:** provider/payment-attempt progress owned by Payments.
- **Fulfillment state:** shipment, digital-delivery, or service-execution
  progress owned by Fulfillment.

## Decision

### Orders is one business module

The API introduces an `orders` business module only when a real accepted-order
workflow is ready to ship. Orders alone owns:

- Order identity and human-facing order number;
- Order and Order-line persistence;
- immutable accepted commercial snapshots;
- Order lifecycle transitions;
- submission-idempotency records and their result binding;
- order-level customer-service history explicitly introduced by a future
  contract.

Orders does not own or mutate:

- current Product, Variant, SKU, or merchandising state;
- current price selection, discount eligibility, tax calculation, or rounding
  policy;
- Inventory stock, reservation, release, or consumption;
- payment attempts, provider references, authorization, capture, refund, or
  chargeback state;
- shipment, digital delivery, service scheduling, or fulfillment execution;
- authenticated identity, credentials, or staff roles;
- a reusable customer profile or current address book.

Orders receives facts from the owning module through its Module Public Contract
or an approved checkout orchestrator. It never imports another commerce
module's entity, repository, or private persistence service.

### An Order is accepted historical fact

An Order exists only after checkout has validated the current authoritative
facts that apply to the request and has created the durable commercial record.
An Order is not a draft cart, quote, abandoned checkout, or payment attempt.

At acceptance, Orders stores all facts needed to explain the purchase without
reading mutable current records later. A later change to a Product, Variant,
SKU, Catalog description, price, account email, address, or fulfillment policy
does not rewrite an accepted Order.

Orders may retain current scalar source IDs for traceability, but those IDs do
not replace the snapshot and do not authorize live joins as historical truth.

### Order identity and numbering

Every Order has:

- an opaque immutable UUID primary identity;
- one immutable human-facing order number;
- an immutable accepted-at UTC instant;
- UTC created/updated instants;
- one configured order currency;
- a lifecycle status owned by Orders.

The human-facing order number is allocated once, is unique within one store
deployment, and is never reused. The database representation is an integer or
equivalent exact value; the external API represents it as a decimal string to
avoid JavaScript integer precision loss.

Order numbers are monotonically allocated but are not required to be gapless.
Gaps caused by transactions, administrative operations, or concurrency are
acceptable. A gapless sequence would add contention and create a false audit
guarantee.

Presentation prefixes, locale formatting, and invoice numbering are not the
Order number itself. They are separate display or legal-document concerns.

### Initial Order lifecycle

Orders owns one lifecycle dimension with exactly these initial states:

- `submitted`: the customer submitted immutable commercial and delivery facts;
  the Order awaits manual staff acceptance while its short-lived Inventory hold
  remains valid;
- `accepted`: a commercial record and obligations exist;
- `cancelled`: the Order's remaining obligations have been withdrawn through
  an approved cancellation workflow;
- `completed`: all Order-level obligations are terminally satisfied according
  to the later payment and fulfillment contracts.

Allowed transitions are:

```text
submitted -> accepted
submitted -> cancelled
accepted -> cancelled
accepted -> completed
```

`cancelled` and `completed` are terminal. No generic reopen, status patch, or
delete operation exists.

The first manual-payment Checkout creates a `submitted` Order. An authorized
staff member explicitly accepts it after confirming the applicable Manual
Payment policy and that its Inventory reservations are still valid. Cash on
delivery may be accepted while payment remains pending collection. The word
"accept" is an Order transition; it is not a synonym for recording money.

The Order lifecycle is intentionally not a payment or fulfillment state:

- `accepted` does not mean paid, captured, shipped, delivered, or completed;
- `completed` does not replace detailed payment or fulfillment evidence;
- `cancelled` does not by itself refund payment, release stock, or stop a
  shipment.

Payments and Fulfillment later expose their own named state transitions.
Orders changes lifecycle only through an explicit orchestrated workflow that
has verified the relevant owner contracts.

### Snapshot model

Every accepted Order has one or more immutable Order lines. Each line captures
at minimum:

- immutable Order-line UUID;
- Product ID and Variant ID for traceability;
- Product title snapshot;
- Variant title/label snapshot where applicable;
- SKU snapshot when present;
- selected Option name/value display snapshots where applicable;
- fulfillment-classification snapshot;
- positive integer quantity;
- exact unit commercial amounts and line totals;
- currency;
- discount and tax components/attribution when they apply.

The Order captures at minimum:

- immutable Order number;
- accepted-at instant;
- buyer identity reference when authenticated;
- buyer contact snapshot required for the transaction;
- delivery/service facts required for the selected fulfillment type;
- merchandise subtotal;
- discount total;
- shipping/service total;
- tax total;
- grand total;
- one currency;
- applied terms/policy version identifiers when legally required.

Every monetary field is an exact Money value, including explicit zero values.
Money representation, currency-scale validation, rounding, tax-inclusive versus
tax-exclusive presentation, and price/discount selection remain the authority
of ADR-0007. Orders stores their accepted result; it does not recalculate it.

An initial Orders implementation may omit a snapshot field only when the
relevant capability is not yet implemented and the Order cannot represent that
kind of obligation. It must not use nullable placeholder price, tax, shipment,
or address columns to claim support it does not have.

### Buyer identity and customer access

The first accepted-order workflow requires an authenticated buyer. Guest
checkout is not introduced by this ADR.

Orders stores the authenticated Identity user ID as a scalar traceability and
access reference, plus a buyer contact snapshot. Identity remains authoritative
for the current account. Orders remains authoritative for the accepted buyer
facts required to explain the transaction.

Customer-facing Order access is ownership-based:

- a customer list is scoped by authenticated user ID;
- a customer detail lookup scopes by both Order ID (or number) and
  authenticated user ID in the query;
- a missing, cancelled, archived, or another customer's Order follows the
  contract's non-disclosure behavior rather than leaking existence;
- a disabled user cannot access Orders through the existing Identity policy.

Staff access uses explicit Orders permissions under the Authorization contract;
staff role names are never checked directly by an Order controller or service.

### Submission idempotency

Every externally reachable order-submission request provides an opaque
idempotency key. The key is scoped to the authenticated buyer and the
submission operation.

Orders persists enough information to enforce these rules atomically:

1. A first valid submission reserves the key while the submitted Order is
   created.
2. Retrying the same key with the same canonical request returns the same
   submitted/accepted Order result; it never creates a second Order.
3. Reusing the key with a different canonical request fails with `409 Conflict`.
4. A failed database transaction leaves neither an accepted Order nor a claimed
   key.
5. Idempotency records are retained at least as long as an order-submission
   retry can reasonably occur; the initial policy is to retain them for the
   lifetime of the Order unless an explicit retention decision supersedes it.

The canonical request fingerprint includes the ordered intended Variant IDs,
quantities, accepted checkout inputs, and other commercial inputs defined by
the eventual Checkout contract. It excludes transport-only noise such as JSON
property order and request correlation IDs.

An idempotency key is not a payment-provider idempotency key. Payments owns its
own provider-facing keys and retries.

### Checkout and cross-module transaction boundary

Checkout is a named application orchestrator, not a module that writes every
commerce table. For an accepted Order, it coordinates owner contracts in this
logical sequence:

1. authenticate and validate the submission request;
2. validate the submission idempotency key;
3. resolve current Catalog facts for every requested Variant;
4. obtain an exact Pricing result;
5. obtain required Tax/Promotion results when those capabilities exist;
6. reserve tracked Inventory when Inventory applies;
7. create the Order, lines, snapshots, totals, number, and idempotency result;
8. initiate payment only through the later Payments workflow.

Where inventory reservation and Order creation require shared-database atomic
commit, the orchestrator uses ADR-0003's opaque transaction context. Catalog,
Pricing, Inventory, and Orders retain authority over their own writes inside
that transaction.

No external payment, tax, email, shipping, digital-delivery, or storefront
network operation is held inside the PostgreSQL transaction. A database commit
does not prove an external operation succeeded. Provider calls, durable
delivery, retry, and recovery require a focused Payments/Fulfillment decision.

### Payment relationship

The default ordering is Order-before-payment: checkout creates an accepted
Order with immutable commercial snapshots before a Payment attempt is created.

This produces one durable commercial reference for payment attempts and
customer support. A failed or abandoned payment attempt does not delete or
rewrite the Order. A later policy may cancel an unpaid accepted Order through a
named cancellation workflow; it is not silently removed.

Payments owns provider attempts, authorization, capture, refund, failure, and
chargeback state. Orders may expose a read-only payment summary projection
after the Payments contract exists, but it does not maintain payment state as
its own mutable columns.

### Fulfillment relationship

Fulfillment owns shipment, digital delivery, service execution, and their
operational states. Orders snapshots the selected fulfillment classification and
facts required to explain the commercial obligation.

Orders does not create shipments, issue downloads, reserve appointments, or
mark a line fulfilled. It may transition `accepted` to `completed` only when a
later explicit workflow verifies that all relevant payment and fulfillment
obligations have reached their required terminal state.

### Cancellation boundary

Cancellation is a coordinated workflow, not a field update. An accepted Order
may be cancelled only after the workflow applies the policies of the owning
capabilities, as applicable:

- Payments determines whether refund, void, or no financial action is needed;
- Inventory releases a still-valid reservation or records a compensating
  adjustment according to its contract;
- Fulfillment determines whether shipment/delivery/service execution can stop
  or needs a separate reversal;
- Orders records the final `cancelled` lifecycle transition and its safe reason
  code.

The first Order implementation does not expose a customer cancellation endpoint
or arbitrary staff cancellation. It adds cancellation only with the required
Payments, Inventory, and Fulfillment policies.

### Corrections, retention, and deletion

Accepted snapshot fields and totals are immutable. An ordinary update endpoint
never changes an accepted Order, Order line, buyer contact snapshot, quantity,
price result, tax result, or total.

Version 1 introduces no correction/adjustment mechanism. A future correction
workflow must be append-only, auditable, attributable, and must not overwrite
the original accepted facts. Refunds and financial adjustments are not a
substitute for changing an Order line in place.

Orders are not hard-deleted through normal business APIs. Identity deletion,
Catalog archival, SKU changes, address changes, and cross-module cascades never
delete or rewrite Order history. Privacy retention, export, legal hold, and
anonymization receive a dedicated decision before production launch where
required.

### Read models and external APIs

Orders exposes separate customer and staff read models:

- customer models include only the customer's own safe snapshots and
  order/payment/fulfillment summaries authorized for that surface;
- staff models include customer-service fields only under explicit permissions;
- reporting/dashboard projections are read-only and non-authoritative.

An Order API returns snapshots and permitted summaries, never live Catalog
entities, current Product price, current stock, credentials, session state, or
private payment-provider payloads.

External endpoint shapes, cursor behavior, customer/staff permissions,
response field allow-lists, cancellation policies, and OpenAPI behavior are
defined in the Orders contract before implementation.

### No standalone premature Orders code

ADR-0006 authorizes the Orders design, not a fake checkout implementation.
Exact Money representation and price results are not approved until ADR-0007;
stock reservation and its concurrency behavior are not approved until
ADR-0008. Therefore:

- no Order submission, totals, Pricing placeholder, Inventory placeholder, or
  payment workflow is implemented from this ADR alone;
- no empty `orders` module is created merely to reserve a directory;
- an Orders implementation contract is written only after ADR-0007 and
  ADR-0008 are accepted, or after a narrower real manual-order requirement is
  separately accepted;
- the first executable commerce vertical slice implements Catalog, Pricing,
  Inventory, and Orders together through named owner contracts and the checkout
  orchestrator.

This sequencing prevents a Cursor or contributor from placing `price`, `stock`,
or provider behavior in the wrong module merely to make an Order endpoint run.

## Explicit non-goals

This decision does not introduce:

- a Cart, guest checkout, or checkout UI;
- Money storage format, rounding rules, tax engine, discounts, or price lists;
- Pricing or Inventory implementation;
- payment provider selection, webhooks, capture, refund, chargebacks, or
  payment retries;
- shipment, digital delivery, service scheduling, or fulfillment execution;
- customer profile or address-book ownership;
- customer/staff cancellation APIs;
- invoice, credit note, or legal numbering;
- partial Orders, split Orders, backorders, subscriptions, bundles, rentals,
  gift cards, marketplace orders, or multi-currency conversion;
- guest Order lookup;
- generic status patch endpoints;
- correction, editing, or hard deletion of accepted Order snapshots;
- an event bus, outbox, saga framework, CQRS system, or distributed transaction.

## Alternatives considered

### Live joins to current Catalog and Pricing data

Rejected because titles, SKUs, Product status, and prices change. Historical
commercial facts must remain explainable without trusting mutable current data.

### Product ID as the purchasable line reference

Rejected because every purchasable unit is a Variant under ADR-0004 and
ADR-0005. Product ID may be retained for traceability but cannot replace
Variant ID on a line.

### One combined order/payment/fulfillment status

Rejected because payment and fulfillment can progress independently and may be
partial. A combined state obscures operational truth and makes transitions
ambiguous.

### Payment-before-Order

Rejected as the default because it leaves payment attempts without a durable
commercial record and complicates support/retry correlation. Payment attempts
reference an accepted Order; external failure does not erase history.

### Gapless human-facing order numbers

Rejected because concurrency and rollback make gaplessness expensive and still
not a reliable audit property. Unique, immutable numbers with acceptable gaps
are operationally sufficient.

### Client-generated order identity

Rejected because trusted server allocation, immutable numbering, and scoped
idempotency provide clearer authority. Clients supply idempotency keys, not
Order primary keys.

### Treat an idempotency key as a payment key

Rejected because payment providers have different retry, expiry, and failure
semantics. Orders and Payments each own idempotency at their own boundary.

### Implement Orders before Pricing and Inventory are designed

Rejected because it would force placeholder Money, fake stock, or a checkout
path that later contracts must undo. The first real Order submission is a
vertical slice after those contracts exist.

## Consequences

### Positive

- Accepted Orders remain historically explainable.
- Customer retries cannot create duplicate Orders.
- Payment and fulfillment can evolve without overloading Order lifecycle.
- Cancellation and completion require explicit coordinated workflows.
- Human-facing order references are stable and useful for customer support.
- Future checkout has clear owner-contract and transaction boundaries.

### Negative

- Order creation waits for Pricing and Inventory contracts before a real
  checkout slice can ship.
- Snapshot storage intentionally duplicates selected current facts.
- Customer cancellation and correction are deferred rather than exposed as
  convenient generic updates.
- Payments and Fulfillment require later focused decisions before complete
  operational workflows exist.

## Architectural invariants

An implementation complies with this decision only if:

1. Orders alone mutates Order, Order-line, Order-number, and submission
   idempotency state.
2. An accepted Order is historical fact, never a live Catalog/Pricing view.
3. Every purchased line references Variant ID and snapshots the required
   Catalog-owned display facts.
4. Accepted snapshots and totals are never edited in place.
5. Every monetary fact is exact and includes one explicit Order currency.
6. Orders does not calculate current price, tax, discount, or rounding policy.
7. Orders does not mutate Catalog, Pricing, Inventory, Payments, Fulfillment,
   Identity, or Authorization persistence.
8. Order number and internal UUID are immutable and never reused; number gaps
   are permitted.
9. One external submission idempotency key can create at most one accepted
   Order for its authenticated buyer and canonical request.
10. Retrying the same idempotent request returns the original result; a key
    reused for a different request conflicts.
11. An Order's lifecycle is separate from payment and fulfillment state.
12. Only `accepted -> cancelled` and `accepted -> completed` are initial
    lifecycle transitions.
13. Cancellation is a named cross-capability workflow, not a field update.
14. No external network call is held inside the PostgreSQL transaction that
    accepts an Order.
15. Customer Order queries scope by both authenticated buyer ID and Order
    identity, without existence disclosure.
16. Staff access uses explicit permissions and never role-name checks.
17. No cross-module cascade deletes or rewrites Order history.
18. No real Order submission implementation starts before exact Pricing and
    Inventory contracts are accepted.

## Acceptance criteria before implementation

Before a Cursor or contributor writes Orders code, the project must have:

1. accepted ADR-0007 defining exact Money representation, price selection,
   rounding, and the authoritative price result consumed by checkout;
2. accepted ADR-0008 defining stock tracking, reservation lifecycle,
   concurrency, and the Inventory contract consumed by checkout;
3. an approved Orders behavioral contract defining exact schemas, API routes,
   permission keys, error codes, retention, and test matrix;
4. a reviewed Checkout orchestration sequence including idempotency and the
   opaque shared transaction boundary;
5. a decision for the first supported fulfillment type and buyer contact/
   delivery facts; this is physical shipment with an immutable delivery-address
   snapshot and a Shipping quote in the first slice;
6. tests proving snapshot immutability, numbering uniqueness, idempotency,
   transaction rollback, cross-customer access denial, and no live-read
   historical dependency.

## Freeze policy

After acceptance, this ADR is frozen. Editorial corrections may clarify
wording without changing meaning. A normative change to ownership, snapshots,
idempotency, lifecycle, order-before-payment, cancellation, or cross-module
transaction boundaries requires a dated amendment or superseding ADR.

## Related decisions

- ADR-0001 defines platform principles and independent store deployments.
- ADR-0003 defines module authority, Module Public Contracts, transactions,
  projections, and dependency enforcement.
- ADR-0004 defines the commerce capability map, checkout orchestration, and
  historical-order requirement.
- ADR-0005 defines Catalog Product/Variant identities and snapshots.
- ADR-0007 defines Money and Pricing.
- ADR-0008 defines Inventory and reservations.
- A later Payments decision defines provider attempts and payment state.
- A later Fulfillment decision defines shipment, digital delivery, and service
  execution.
