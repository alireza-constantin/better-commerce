# External HTTP API Contract

Status: Implemented baseline
Updated: 2026-07-26

## Scope

This contract governs the supported boundary between the Better Commerce API
and Admin, storefront-core, reference storefronts, and independent merchant
storefronts.

The contract consists of:

- versioned HTTP routes under `/api/v1`;
- the generated OpenAPI document;
- RFC 9457-style problem responses;
- the generated-backed `@better-commerce/sdk` package.

NestJS providers, module contracts, repositories, ORM entities, database
columns, and implementation-only TypeScript types are not external contracts.

## OpenAPI authority

Controller transport DTOs and decorators produce the OpenAPI document served at
`/docs/openapi.json` outside production. The served document is the source of
truth for SDK generation. SDK types are never maintained as a handwritten copy
of backend types.

Every operation has:

- one unique deterministic operation ID;
- documented success schemas;
- an `x-request-id` response header;
- a typed default `application/problem+json` response.

The OpenAPI UI and JSON are disabled in production. Published SDK artifacts are
generated and verified before deployment; production does not need to expose
schema tooling.

## Representations

- JSON is the normal success representation.
- Empty successful operations return `204` with no body.
- Dates and timestamps are ISO 8601 UTC strings.
- UUID identifiers are serialized as strings.
- Money is a decimal string plus an ISO 4217 currency code. Floating-point
  numbers and database minor-unit columns are not exposed as money.
- Nullable values are explicit in response schemas.
- Persistence entities are mapped to transport views before leaving the API.

## Errors

Exceptions are returned as `application/problem+json` with:

- `type`;
- `title`;
- `status`;
- `detail`;
- `requestId`;
- optional validation `errors`;
- optional safe scalar extensions such as `code`, `currentVersion`, or
  `retryAfterSeconds`.

Unknown exceptions never expose stack traces or internal error details.
Rate-limited responses also use the `Retry-After` header.

## Pagination

Collection endpoints use bounded cursor pagination. New collection contracts
use:

```json
{
  "items": [],
  "nextCursor": null
}
```

The cursor is opaque to callers. Consumers must return it unchanged. A cursor
is bound to the endpoint's stable descending timestamp-and-ID order; malformed
cursors return `400`.

The current maximum page size is 100. Offset pagination is not part of the
external contract.

The older Authorization staff and audit endpoints retain their existing `data`
property until a separately reviewed compatibility change.

## Sessions, CSRF, and idempotency

Authentication uses the opaque HttpOnly server-side session cookie. Browser
clients use credentialed requests and never read the cookie.

State-changing browser requests obtain a session-bound CSRF token from
`GET /api/v1/auth/csrf` and send it in `x-csrf-token`.

CSRF middleware rejects a missing, stale, or invalid token before controller
execution with `403` and problem code `security.csrf_invalid`. A client may
invalidate its in-memory token, acquire a new one, and replay that rejected
request exactly once. It must not replay a generic `403` or retry more than once
without a new user action.

Checkout additionally requires an `Idempotency-Key` header. Reusing a key with
the identical request returns the original Order. Reusing it for a different
request returns a conflict.

## SDK

`packages/sdk` contains:

- generated immutable OpenAPI path, operation, and component types;
- a neutral low-level `openapi-fetch` client factory;
- a `/browser` client entry point that always includes browser credentials;
- a `/server` client entry point that requires an absolute API base URL,
  clones request-scoped headers, and omits browser credential behavior;
- explicit package exports and browser/server consumer fixtures.

The SDK contains no pricing, inventory, authorization, shipping, payment, or
order business rules. CSRF lifecycle belongs to the consuming application's
integration layer, such as the Admin API adapter or `storefront-core`.
Checkout orchestration belongs to the future `storefront-core/browser` entry
point.

Public Product responses include display-only price ranges, exact decimal Money
strings, per-Variant prices, and conservative availability states. They never
expose on-hand or reserved quantities. Missing Price or Inventory configuration
makes a Variant non-purchasable in the projection. Checkout remains
authoritative and revalidates Price and Inventory regardless of the displayed
projection.

The root factory does not guess runtime credential or cookie policy. Browser
applications use `@better-commerce/sdk/browser`. Server renderers use
`@better-commerce/sdk/server` and create a client per incoming request whenever
customer context is forwarded. The SDK never reads an ambient cookie jar,
retains request headers globally, or imports a UI or meta-framework.

`@better-commerce/storefront-core/server` composes these generated Product
responses into framework-neutral view models, preserves exact Money strings,
propagates request cancellation, and exposes cache-key inputs without owning a
renderer cache.

With the API running locally:

```bash
pnpm sdk:generate
pnpm sdk:check
```

`sdk:check` fails when the committed generated types differ from the served
OpenAPI contract.

## Compatibility

The current package and API are pre-1.0 and have no external production
consumer yet. Contract-breaking cleanup is allowed only as an explicit,
reviewed platform change that updates the API, generated SDK, documentation,
and contract tests atomically.

Once the first external storefront consumes the package, breaking changes
require a compatibility and deprecation decision before implementation.
