# Promotions and Discounts Contract

Status: Draft implementation contract
Scope: ADR-0018 Promotions and Discounts
Version: 1.0-draft
Date: 2026-08-16
Authority: `docs/adr/0018-promotions-and-discounts.md`

## 1. Purpose and boundary

This contract defines the external HTTP and module behavior for Promotions.
Promotions is the authority for campaign definitions, eligibility, discount
allocation, and redemption usage. It does not own Catalog, Pricing, Cart,
Shipping, Payments, Inventory, or Order persistence.

Pricing supplies the exact base merchandise amounts. Promotions returns an
exact discount quote. Checkout is the only operation that can accept the
combined result and snapshot it on an Order.

## 2. Fixed limits

| Resource or input | Limit |
| --- | ---: |
| Promotion name | 160 characters |
| Promotion description | 2,000 characters |
| Promotion code | 64 normalized ASCII characters |
| Variant targets | 500 IDs |
| Category targets | 100 IDs |
| Collection targets | 100 IDs |
| Priority | 0 through 1,000,000 |
| Total redemptions | 1 through 10,000,000 when set |
| Per-customer redemptions | 1 through 1,000 when set |
| Cursor page size | Default 25, maximum 100 |

All limits are deployment-independent contract limits and are validated before
persistence. A violation returns `promotion.validation_failed`.

## 3. Promotion representation

Administrative responses contain:

| Field | Contract |
| --- | --- |
| `id` | Immutable UUID |
| `version` | Positive optimistic-concurrency version |
| `definitionVersion` | Immutable accepted definition identity |
| `status` | `draft`, `scheduled`, `active`, `paused`, or `ended` |
| `name` | Required trimmed human-facing name |
| `description` | Nullable trimmed plain text |
| `code` | Nullable normalized code; never returned in public projections |
| `eligibility` | `public` or `code_required` |
| `rule` | `percentage` or `fixed_amount` |
| `percentage` | Nullable decimal string from `0.01` through `100.00` |
| `amount` | Nullable exact Money in the configured currency |
| `target` | `cart`, `variants`, `categories`, or `collections` |
| `targetIds` | Stable UUIDs, empty only for `cart` |
| `priority` | Integer priority |
| `startsAt` | UTC instant |
| `endsAt` | Nullable UTC instant after `startsAt` |
| `totalLimit` | Nullable positive integer |
| `perCustomerLimit` | Nullable positive integer |
| `redemptions` | Current committed usage counters |
| `createdAt` / `updatedAt` | UTC instants |
| `createdBy` / `updatedBy` | Safe actor references |

`percentage` and `amount` are mutually exclusive. Fixed amounts use the
configured store currency and ADR-0007 decimal-string Money representation.
No floating-point number or database minor-unit value crosses the HTTP
boundary.

The public storefront projection contains only safe fields needed to explain a
quote: `definitionVersion`, display name, rule attribution, exact discount,
and line allocations. It never exposes staff actors, redemption counters,
internal IDs unrelated to the quote, or a code-required campaign definition.

## 4. Lifecycle and versioning

Creation starts a Promotion in `draft`. A definition becomes `scheduled` or
`active` only through an explicit administrative command. The server derives
the effective status from the lifecycle command and UTC schedule; clients may
not submit arbitrary status transitions.

Allowed transitions are:

```text
draft -> scheduled -> active -> ended
draft -> active -> ended
scheduled -> paused -> scheduled
active -> paused -> active
scheduled -> ended
active -> ended
paused -> ended
```

An ended Promotion is terminal. A paused Promotion keeps its definition and
limits but is not eligible. Updating a definition creates a new immutable
`definitionVersion`; accepted Orders retain the earlier version. Every
definition and lifecycle mutation requires `expectedVersion` and increments
the administrative Promotion version exactly once. A stale version returns
`409` with `promotion.version_conflict` and the current version.

## 5. Administrative HTTP API

All routes are under `/api/v1/admin/promotions` and require an authenticated
staff session, origin checks, CSRF for mutations, and exact permissions.

### 5.1 Collection and detail

```text
GET  /api/v1/admin/promotions?status=&q=&cursor=&limit=
GET  /api/v1/admin/promotions/:promotionId
POST /api/v1/admin/promotions
PUT  /api/v1/admin/promotions/:promotionId/definition
POST /api/v1/admin/promotions/:promotionId/activate
POST /api/v1/admin/promotions/:promotionId/pause
POST /api/v1/admin/promotions/:promotionId/end
GET  /api/v1/admin/promotions/:promotionId/redemptions?cursor=&limit=
```

Reads require `promotions.read`. Creation and every mutation require
`promotions.write`. The list is cursor-paginated in stable updated-descending
order, with an optional exact status filter and title/code prefix search. It
does not promise totals or offset pages.

Creation and definition replacement return the complete authoritative
Promotion representation. Definition replacement accepts:

```json
{
  "expectedVersion": 3,
  "name": "تابستان",
  "description": "تخفیف محصولات منتخب",
  "eligibility": "code_required",
  "code": "SUMMER26",
  "rule": { "kind": "percentage", "percentage": "15.00" },
  "target": { "kind": "variants", "ids": ["uuid"] },
  "priority": 100,
  "startsAt": "2026-07-01T00:00:00.000Z",
  "endsAt": "2026-07-31T23:59:59.999Z",
  "totalLimit": 1000,
  "perCustomerLimit": 1
}
```

The API rejects duplicate normalized codes, invalid target IDs, mixed target
kinds, invalid schedules, fixed amounts in another currency, and definitions
that would produce no eligible target.

### 5.2 Checkout quote

The existing Cart checkout-preparation and cart-order routes accept an optional
`promotionCode` string. They pass Cart lines and fresh Pricing/Catalog facts to
Promotions. The preparation response includes:

```json
{
  "promotion": {
    "status": "applied",
    "promotionId": "uuid",
    "definitionVersion": "uuid",
    "name": "تابستان",
    "code": "SUMMER26",
    "discount": { "amount": "15.00", "currency": "USD" },
    "allocations": [
      { "variantId": "uuid", "amount": "7.50", "currency": "USD" }
    ]
  }
}
```

The result can instead be `not_applied` with a stable reason such as
`missing_code`, `invalid_code`, `not_started`, `ended`, `paused`,
`not_eligible`, `limit_reached`, or `no_eligible_lines`. A rejected optional
code does not make a cart unreadable, but final checkout must require the
customer to remove or correct a code that cannot be applied; it must never
silently charge a different amount than the customer confirmed.

Final checkout re-evaluates the code and all targets inside the existing
transaction. It claims redemption usage only after all Order, Payment, and
Inventory work succeeds. A concurrent limit failure rolls back the complete
checkout and returns `promotion.limit_reached`.

## 6. Discount calculation

Promotions receives one configured-currency base amount per Cart line. It
selects at most one eligible Promotion by highest priority; stable Promotion
identity breaks equal-priority ties.

For a percentage rule, each eligible line receives its exact percentage of the
line merchandise amount. For a fixed rule, the amount is capped at the eligible
merchandise subtotal. If a fixed discount must be divided across lines,
minor-unit largest remainder allocation is used; Variant ID ascending is the
tie-breaker. Every allocation is non-negative and allocations sum exactly to
the returned total discount.

Discounts apply only to merchandise. Shipping, service charges, future tax,
payment fees, and inventory availability are not discount inputs in version 1.

## 7. Problems and authorization

In addition to shared external API problems, implementations expose these
stable problem types:

- `promotion.validation_failed` — invalid definition or target;
- `promotion.not_found` — unknown or inaccessible Promotion;
- `promotion.version_conflict` — stale administrative version;
- `promotion.invalid_state` — lifecycle command is not allowed;
- `promotion.code_invalid` — supplied code is malformed or not found;
- `promotion.not_eligible` — code/campaign does not apply to the Cart;
- `promotion.limit_reached` — redemption capacity is exhausted;
- `promotion.currency_mismatch` — fixed rule does not match store currency.

Permission failures remain generic `403` responses and do not disclose whether
a Promotion exists. Administrative error responses never expose SQL, stack
traces, credentials, or internal rule evaluation details.

## 8. Order and audit integration

Accepted Order representations add immutable promotion facts: Promotion ID,
definition-version ID, optional code, display name, exact discount total, and
per-line allocations. The Order does not join live Promotion rows to explain
history.

Successful creation, definition replacement, lifecycle changes, and committed
redemptions write allowlisted append-only commerce audit events in the same
transaction as their mutation. No event is written after rollback.

## 9. Required verification

Before implementation is accepted, tests must prove:

1. exact percentage and fixed Money arithmetic without floating point;
2. all target kinds and invalid target combinations;
3. lifecycle schedule boundaries and pause/end behavior;
4. code normalization and public/code-required eligibility;
5. priority and identity tie-breaking;
6. largest-remainder allocation and zero-floor behavior;
7. total/per-customer redemption races under concurrent checkout;
8. stale Promotion, Cart, Price, and Catalog facts;
9. rollback leaves Order, Payment, Inventory, Cart, and redemption state
   unchanged;
10. idempotent checkout replay returns the original Order and does not double
    redeem;
11. permission, CSRF, cross-customer, and information-disclosure boundaries;
12. generated OpenAPI/SDK schemas match this contract.

