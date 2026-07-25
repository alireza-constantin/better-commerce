# ADR-0007 — Exact Money and Pricing

Status: Accepted
Date: 2026-07-25
Accepted: 2026-07-25
Frozen: 2026-07-25

## Context

ADR-0004 assigns current price selection to Pricing, not Catalog. ADR-0005
therefore contains no price column on Product or Variant. ADR-0006 requires
Orders to preserve exact accepted commercial amounts without recalculating them
from current prices.

Pricing must be small enough for the first store while making the later path to
scheduled prices, customer groups, promotions, tax, and multiple currencies
explicit rather than pretending one mutable `variant.price` column will grow
safely into all of them.

This ADR defines exact Money representation, one-currency initial pricing,
immutable price versions, authoritative price quotes, concurrency, and the
boundary to Orders. It does not implement discounts, taxes, promotions,
currencies conversion, or a payment provider.

## Decision drivers

- No binary floating-point monetary values
- Exact, explainable Order snapshots
- One configured store currency today
- A safe price-change history
- Correct concurrent checkout and price-update behavior
- A narrow price quote contract for checkout
- No promotion or tax engine before it is needed

## Vocabulary

- **Money:** an exact non-floating-point amount paired with an ISO 4217
  currency code.
- **Minor unit:** the smallest configured decimal unit of a currency, such as
  cents for USD.
- **Minor amount:** an integer count of minor units.
- **Price version:** one immutable selling-price record for a Variant.
- **Current price:** the one eligible Price version selected for a Variant at a
  specific instant under the initial rules.
- **Price quote:** Pricing's authoritative exact result for requested Variants.
- **Base selling price:** the pre-discount merchandise amount for one unit;
  version 1 has no separate sale-price or promotion engine.

## Decision

### Pricing is one business module

The API introduces a `pricing` business module only with real price behavior.
Pricing alone owns:

- Money parsing and validation at Pricing boundaries;
- Price version records and their effective lifecycle;
- current price selection;
- price quotes returned to checkout and read models;
- Price change concurrency and history.

Pricing does not own or mutate Catalog, Inventory, Orders, Cart, Payments,
Tax, Promotions, Identity, or Authorization persistence. It references
Catalog Variant IDs as scalars and uses Catalog's Module Public Contract when
it must validate an administrative price target.

### Exact Money representation

The internal Money value is:

```text
Money = { minorAmount: bigint, currency: ISO-4217 uppercase code }
```

Persistent Money stores:

- `minor_amount` as PostgreSQL `bigint`;
- `currency` as a three-character uppercase ISO 4217 code.

No float, JavaScript `number`, PostgreSQL floating type, or serialized numeric
JSON value represents a commercial amount.

External APIs accept and return Money as:

```json
{ "amount": "19.99", "currency": "USD" }
```

`amount` is a canonical decimal string. API parsing validates it against the
currency scale, converts it to `minorAmount`, and never uses a binary
floating-point intermediate. APIs do not expose `bigint` as a JSON number.

The currency-scale table is code-owned and versioned with the application. For
the initial one-currency store, the configured store currency and its scale are
validated at startup. A value with excess fractional digits is rejected; it is
never silently rounded.

Money arithmetic requires matching currencies. Addition, subtraction, and
comparison across currencies fail explicitly. Rounding is not a generic Money
operation: a future Tax, Promotion, or conversion contract must name its
rounding rule and produce a final Money result.

### Initial currency policy

One deployment has one configured selling currency in version 1. Every active
Price version and every Price quote uses that currency. A request cannot choose
a different currency, and there is no exchange rate, conversion, or currency
display preference.

An Order also uses one currency. The configured-store-currency rule is an
initial operating policy, not permission to omit currency from any persisted or
external commercial fact.

### Immutable Price versions

Pricing stores immutable Price versions per Variant. A version contains:

- opaque UUID;
- Variant ID scalar reference;
- exact base selling Money;
- configured store currency;
- `effectiveFrom` UTC instant;
- nullable `effectiveUntil` UTC instant;
- `createdAt` UTC instant;
- safe actor reference where an authorized staff change created it.

Price amounts are strictly greater than zero in version 1. Free goods, deposits,
negative adjustments, gift cards, and credit balances require focused later
decisions.

Changing a price creates a new Price version; it never updates the amount on an
old version. When an immediate replacement is accepted, Pricing closes the
previous current version and opens the new version in one transaction.

For one Variant and the configured currency, effective intervals must not
overlap. The initial administrative workflow supports immediate price changes
only. Scheduled prices may be introduced later by using the same interval model
only after explicit scheduling and conflict rules are accepted.

Archived Catalog Variants retain Price history, but their price is not eligible
for checkout because Catalog determines Variant eligibility.

### Price selection and quote

Pricing exposes an authoritative Module Public Contract operation conceptually
equivalent to:

```text
quoteVariantPrices(variantIds, transactionContext?)
```

For each requested Variant, the quote returns:

- Variant ID;
- selected immutable Price-version ID;
- exact unit base selling Money;
- configured currency;
- quote/calculation instant;
- any later explicit pricing adjustments as separately named components.

Version 1 quote selection is deterministic:

1. select the single current effective Price version for each Variant;
2. require the configured store currency;
3. return its exact unit base selling amount;
4. return no discount, promotion, tax, shipping, or total calculation.

A missing current price is a business eligibility failure, not an implicit zero
price. Pricing does not decide Catalog visibility or stock availability.

Checkout obtains the quote inside its accepted shared PostgreSQL transaction.
The selected Price versions are protected from concurrent replacement for the
duration required to create the Order snapshots. A price update and checkout
therefore serialize predictably: an Order snapshots either the old valid Price
version or the new valid Price version, never a mixed or partially closed
state.

### Order boundary

Orders receives immutable quote results and stores their exact accepted values
on its lines and totals. It retains Price-version ID for traceability but does
not use it to reprice history.

Pricing does not create Orders, calculate Order status, mutate Order totals, or
hold a mutable link to an accepted Order. A later refund or correction workflow
uses payment/financial policies; it does not reopen historic Price versions.

### Tax, discounts, and display prices

Version 1 has one base selling price per Variant and no promotions, coupon,
sale-price, compare-at price, customer group, quantity break, bundle, tax,
shipping, or currency-conversion rule.

The base selling price is merchandise-only and must not be labelled a final
tax-inclusive customer total. A future Tax decision defines whether prices are
entered/displayed tax-inclusive or tax-exclusive, tax quote inputs, rounding,
and what the Order snapshots. A future Promotions decision defines discounted
price selection and attribution.

Storefronts may display the current base price as a Catalog/Pricing read model,
but checkout must obtain a fresh authoritative quote.

### Administrative access and audit boundary

Pricing administrative access is default-deny and requires explicit stable
permissions:

- `pricing.read` for administrative price history/list/detail;
- `pricing.write` for immediate Price-version changes.

The authorization catalogue and built-in role grants are amended when Pricing
is implemented. `catalog.pricing.write` is not used for new behavior because
Pricing is a separate authority; its removal/compatibility treatment is made
explicit in that implementation contract.

Price changes create immutable Pricing history. They may emit safe structured
logs. A generalized cross-domain audit system is not introduced by this ADR.

### Read models

Pricing may provide read-only current-price projections by Variant ID for
storefronts and administrative product lists. These projections:

- contain exact Money with currency;
- are non-authoritative outside a fresh checkout quote;
- do not mutate Catalog;
- do not include stock or universal availability;
- return a distinct missing-price result rather than a fake zero.

At the expected scale, direct PostgreSQL reads are sufficient. No price cache,
search index, event bus, outbox, or pricing service deployment is introduced.

## Explicit non-goals

This decision does not introduce:

- floating-point amounts;
- multiple selling currencies or currency conversion;
- scheduled prices;
- promotions, coupons, sales, compare-at prices, or customer groups;
- taxes, tax-inclusive display, tax providers, or tax calculation;
- shipping/service charges;
- free products, deposits, gift cards, store credit, or negative prices;
- Cart, Checkout UI, Payments, or Order implementation;
- a generic money package outside the API;
- external pricing services, caches, events, workers, or an outbox.

## Alternatives considered

### Floating-point price fields

Rejected because binary floating-point creates non-exact commercial amounts and
unexplainable totals.

### Decimal amounts without a minor-unit representation

Rejected for persisted commercial amounts because arithmetic and comparison
become less explicit. Decimal strings are accepted at the API boundary, then
converted exactly to integer minor units.

### Mutable `variant.price`

Rejected because Catalog would own Pricing state and historic price changes
would be difficult to explain.

### One mutable current-price row

Rejected because immutable Price versions provide price history and a stable
traceability reference for an accepted Order.

### Discounts and tax in the first price model

Rejected because their eligibility, rounding, legal, and display semantics need
focused decisions. A single exact base price is the smallest correct start.

### Price cache or remote pricing service

Rejected because a direct PostgreSQL module contract is simpler, coherent with
checkout transactions, and sufficient at the expected scale.

## Consequences

### Positive

- Every current and accepted price is exact and currency-explicit.
- Price changes retain history without rewriting Orders.
- Checkout has a narrow deterministic quote contract.
- Catalog stays free of price authority.
- Promotions and tax have clear future boundaries.

### Negative

- Admin price changes create new records rather than editing one field.
- Price history and interval constraints add persistence work.
- Initial stores have no discounts, sales, or multi-currency behavior.
- Orders cannot present a final tax/shipping-inclusive total until later
  capabilities define it.

## Architectural invariants

An implementation complies with this decision only if:

1. Pricing alone mutates Price versions and quote behavior.
2. Persisted commercial amounts are integer minor units plus explicit currency.
3. APIs accept/return canonical decimal strings, never floating JSON numbers.
4. Money arithmetic never crosses currencies implicitly.
5. Catalog contains no authoritative price field.
6. A Price change creates a new immutable version and does not edit the old
   amount.
7. Effective Price-version intervals for one Variant/currency never overlap.
8. A current quote returns one exact valid Price version or a missing-price
   failure; it never returns zero by default.
9. Checkout snapshots a quote inside its controlled transaction.
10. Orders retain accepted price facts and never reprice history from current
    Price versions.
11. Pricing does not decide Catalog eligibility, Inventory availability, or
    payment/fulfillment state.
12. Version 1 contains one configured currency, immediate prices only, and no
    discount/tax/promotion behavior.
13. No Price implementation begins until its behavioral contract and test
    matrix are approved.

## Acceptance criteria before implementation

The Pricing contract must define and test:

1. exact decimal-string parsing and minor-unit conversion for the configured
   currency;
2. currency-scale validation and overflow behavior;
3. Money arithmetic and cross-currency rejection;
4. immediate Price-version creation/replacement and non-overlapping intervals;
5. concurrent quote-versus-price-change behavior;
6. missing-price behavior;
7. public/admin read-model field allow-lists;
8. Pricing permissions, role grants, errors, and OpenAPI;
9. transaction-aware quote semantics for checkout;
10. proof that no Catalog or Order entity/repository leaks through the Pricing
    contract.

## Freeze policy

After acceptance, this ADR is frozen. A normative change to Money
representation, currency policy, Price-version lifecycle, quote semantics, or
Order boundary requires a dated amendment or superseding ADR.

## Related decisions

- ADR-0003 defines module ownership and opaque transactions.
- ADR-0004 defines Pricing's capability authority and exact-money requirement.
- ADR-0005 defines Catalog Variants.
- ADR-0006 defines immutable Order snapshots.
- ADR-0008 defines Inventory and reservation behavior.
