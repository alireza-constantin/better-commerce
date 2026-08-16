# ADR-0018 — Promotions and Discounts

Status: Proposed
Date: 2026-08-16

## Context

ADR-0007 deliberately defines only one exact base selling Price per Variant.
ADR-0015 defines Cart as mutable purchase intent, while ADR-0006 requires an
Order to preserve the exact commercial result accepted at checkout. The
platform now needs a bounded way to offer promotions without putting discount
authority in Catalog, Pricing, Cart, or the storefront.

Promotions are difficult to change safely after launch because eligibility,
stacking, rounding, usage limits, and historical attribution affect customer
charges and staff explanations. This decision therefore defines the first
promotion language and its ownership before implementation begins.

## Decision

Promotions are a separate API business module and the sole authority for
promotion definitions, eligibility, discount calculation, and redemption
limits. A Promotion never mutates Catalog or Price versions. Pricing continues
to provide the exact base price, and Promotions consumes that result to return
an exact discount quote.

### Version 1 promotion model

A Promotion has:

- an opaque identity and human-facing name;
- an immutable versioned definition;
- lifecycle state `draft`, `scheduled`, `active`, `paused`, or `ended`;
- UTC start and optional end instants;
- an optional normalized customer-entered code;
- an eligibility mode: public or code-required;
- one discount rule: percentage or fixed amount;
- a target: the whole merchandise subtotal, selected Variant IDs, selected
  Category IDs, or selected Collection IDs;
- an optional total-redemption limit and optional per-customer limit;
- an explicit priority used for deterministic selection;
- actor and timestamp history for every definition change.

Percentage rates are bounded to a positive maximum of 100%. Fixed amounts use
the configured store currency and exact decimal-string parsing from ADR-0007.
A discount can never reduce an eligible line or the merchandise subtotal below
zero. Free products, negative prices, credits, gift cards, and multiple
currencies remain outside this decision.

### Eligibility and stacking

At checkout, Promotions evaluates only the submitted Cart lines and the fresh
authoritative Catalog and Pricing facts. A storefront may preview a discount,
but its result is advisory and cannot authorize an Order.

Version 1 applies at most one Promotion to an Order. If multiple eligible
promotions exist, the API selects the highest priority; ties are resolved by
the stable Promotion identity. A code-required Promotion is considered only
when the checkout request supplies its normalized code. Codes are not stored
as authoritative Cart state in version 1; a storefront may retain the user's
input locally and submit it with checkout.

Discounts apply to merchandise only, before shipping and before any future tax
calculation. A targeted discount is allocated across eligible lines using a
deterministic largest-remainder rule in minor units, with line identity as the
stable tie-breaker. The result always contains the exact total discount and
per-line allocations.

Promotion evaluation does not reserve redemption capacity. A successful
checkout claims applicable total and per-customer usage in the same database
transaction that creates the Order. A failed or rolled-back checkout consumes
nothing. Concurrent checkout attempts serialize on the redemption record and
one that exceeds a limit receives a typed eligibility failure.

### Module boundaries

Promotions owns:

- promotion definitions and immutable definition versions;
- code normalization and lookup;
- eligibility evaluation and deterministic allocation;
- redemption counters and history;
- promotion read projections and administrative audit facts.

Promotions does not own or mutate Catalog, Pricing, Inventory, Shipping,
Payments, Orders, Cart, Identity, or Authorization persistence. It calls their
public contracts and receives exact facts. Checkout remains the orchestrator:
it obtains a fresh base-price quote, asks Promotions for a discount quote,
creates immutable Order snapshots, and claims redemption usage atomically.

### Order snapshots and history

When a discount is accepted, Orders snapshots:

- Promotion ID and immutable definition-version ID;
- the entered code when one was used;
- promotion name for support display;
- exact total discount;
- exact per-line allocations and the rule/target attribution.

An Order never recalculates a historical discount from the current Promotion
definition. Pausing, ending, or editing a Promotion affects only future
quotes. Every administrative definition change and redemption result produces
an append-only, safe audit record.

### Authorization and administration

Administrative reads require `promotions.read`; creating, changing, pausing,
ending, and restoring definitions require `promotions.write`. Unknown
permissions remain denied. Admin must show human-readable names and exact
currency-labelled amounts, while technical IDs remain available only in
explicit detail views.

The first Admin workflow manages definitions, schedules, targets, codes,
limits, priority, and redemption history. It does not allow editing an
accepted Order's discount snapshot.

## Explicit non-goals

This decision does not introduce:

- tax calculation, tax-inclusive pricing, or tax providers;
- multiple currencies or currency conversion;
- promotion stacking or combinable discount sets;
- customer groups, segmentation, loyalty points, subscriptions, or
  personalized pricing;
- buy-one-get-one, bundles, gifts, quantity breaks, or shipping discounts;
- refunds, credits, chargebacks, or payment-provider behavior;
- a search index, event bus, cache, or external promotion service;
- automatic persistence of promotion codes in Cart;
- storefront-specific presentation or copy.

## Alternatives considered

### Put discounts in Pricing

Rejected because Pricing owns exact base Price versions and quote selection;
promotion eligibility, usage, and campaign history are a different authority.

### Let the storefront calculate discounts

Rejected because browser-authored totals are not trustworthy and could create
orders that bypass limits or eligibility rules.

### Allow stacking in version 1

Rejected because interaction ordering, caps, rounding, and support explanations
would multiply before the platform has real campaign data.

### Store a discount directly on Cart

Rejected because Cart is intent, not an authoritative commercial quote. The
initial flow submits an optional code to checkout and re-evaluates it there.

### Mutate a Promotion definition in place

Rejected because accepted Orders must remain explainable after a campaign is
edited, paused, or ended. New definitions create immutable versions.

## Consequences

### Positive

- Checkout has one authoritative, exact, auditable discount result.
- Historical Orders remain explainable after campaign changes.
- Catalog, Pricing, Cart, and storefront boundaries remain intact.
- The first rule set is useful without pretending to be a complete marketing
  automation platform.

### Negative

- Checkout becomes a larger cross-module transaction.
- Redemption limits require transactional contention handling.
- Category and Collection targeting depends on current Catalog membership at
  checkout, so campaign outcomes can change when merchandising changes.
- Stacking, tax, and advanced campaign types require later decisions.

## Architectural invariants

An implementation complies with this decision only if:

1. Promotions alone owns promotion definitions, eligibility, allocation, and
   redemption state.
2. Discount amounts use ADR-0007 exact Money rules and the configured currency.
3. Checkout obtains a fresh authoritative discount quote; the browser cannot
   authorize an amount.
4. At most one Promotion applies to an Order in version 1.
5. Discount allocations are deterministic, non-negative, and never exceed the
   eligible merchandise amount.
6. Redemption limits are claimed atomically with successful Order creation.
7. Failed or rolled-back checkout does not consume redemption capacity.
8. Accepted Orders retain immutable Promotion/version/code/allocation facts and
   never re-evaluate history.
9. Promotion definition changes are versioned and append-only for audit.
10. Promotions does not mutate Catalog, Pricing, Inventory, Shipping, Cart,
    Payments, Orders, Identity, or Authorization persistence directly.
11. Tax, shipping discounts, multiple currencies, and advanced campaign types
    are not inferred from this ADR.
12. No implementation begins until the external contract and test matrix are
    reviewed and accepted.

## Acceptance criteria before implementation

The follow-up contract and test matrix must define:

1. percentage and fixed-amount parsing, bounds, and exact rounding;
2. target matching for Variant, Category, Collection, and whole-cart rules;
3. public versus code-required eligibility and code normalization;
4. schedule boundaries, pause/end behavior, and timezone handling;
5. priority and tie-breaking when several promotions are eligible;
6. deterministic largest-remainder line allocation;
7. total and per-customer redemption limits under concurrent checkout;
8. stale Cart, Price, Catalog, and Promotion-version behavior;
9. immutable Order snapshot and audit representations;
10. permission denial, CSRF, idempotency, rollback, and retry behavior;
11. generated SDK and storefront-core result types, including typed failures;
12. Admin management and redemption-history read/write workflows.

