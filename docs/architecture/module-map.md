# Backend Module Map

Status: Living document  
Last verified: 2026-07-28

## Purpose

This document describes the currently implemented API structure and dependency
boundaries. ADR-0003 explains why these boundaries exist; this document changes
when the implementation changes.

## Current source map

```text
apps/api/src/
  app.module.ts                 Composition root

  modules/
    identity/
      auth/                     Registration, login, guards, password policy
      persistence/              User, credentials, verification persistence
      session/                  Session policy and Redis-backed session behavior
      identity.module.ts
      identity-administration.contract.ts
      index.ts                  Module Public Contract

    authorization/
      audit/                    Authorization audit queries
      bootstrap/                Initial owner bootstrap
      data/                     Authorization persistence and catalogue
      enforcement/              Guards, permission metadata, context
      staff/                    Staff lifecycle operations
      authorization.module.ts
      index.ts                  Module Public Contract

    catalog/
      application/              Product commands, projections, and contract
      domain/                   Catalog lifecycle and normalization rules
      http/                     Administrative Catalog transport and DTOs
      persistence/              Catalog-owned TypeORM mappings and operations
      catalog.module.ts
      index.ts                  Narrow Variant-facts Module Public Contract

    pricing/                    Money, immutable Price versions, Admin API
    inventory/                  Stock, adjustments, reservations, Admin API
    shipping/                   Zones, methods, rate rules, quotes, Admin API
    payments/                   Manual-payment state and history
    cart/                       Durable intent, ownership, merge, expiry, versioning
    orders/                     Checkout orchestration, snapshots, Order APIs
    commerce-audit/             Append-only operational commerce history
    public-commerce/            Public Product read composition; no persistence

  platform/
    config/                     Environment parsing and validation
    database/                   TypeORM configuration and opaque transactions
    health/                     Liveness and readiness
    http/authentication/        Public-route transport metadata
    observability/              Logging, request IDs, problem details
    openapi/                    OpenAPI generation and transport decorators
    redis/                      Redis connectivity
    security/                   CSRF, trusted origins, abuse protection

  architecture/
    module-boundaries.spec.ts   Automated ADR-0003 dependency checks
```

The first commerce implementation supports Products and Variants, versioned
Prices, stock reservations, subtotal-based Shipping, manual Payments, and
submitted Orders. Its deferred verification work is tracked in
`docs/plans/commerce-implementation-status.md`.

The external contract toolchain now also contains:

```text
packages/sdk/
  src/generated/schema.ts      Generated immutable OpenAPI contract types
  src/index.ts                 Thin typed HTTP-client public entry point

packages/storefront-core/
  src/server.ts                Framework-neutral public Catalog integration
  src/browser.ts               Session, CSRF, Cart, Orders, checkout integration
  src/index.ts                 Environment-neutral storefront view types
```

The SDK depends on the served OpenAPI document. The API has no source or runtime
dependency on the SDK.

## Dependency direction

```mermaid
flowchart TD
    Composition["app.module.ts — composition root"]
    Identity["Identity module"]
    Authorization["Authorization module"]
    Catalog["Catalog module"]
    Pricing["Pricing module"]
    Inventory["Inventory module"]
    Shipping["Shipping module"]
    Payments["Payments module"]
    Cart["Cart module"]
    Orders["Orders and Checkout module"]
    PublicCommerce["Public Commerce read module"]
    Platform["Platform facilities"]
    IdentityContract["Identity Module Public Contract"]
    AuthorizationContract["Authorization Module Public Contract"]
    CatalogContract["Catalog Module Public Contract"]

    Composition --> Identity
    Composition --> Authorization
    Composition --> Catalog
    Composition --> Pricing
    Composition --> Inventory
    Composition --> Shipping
    Composition --> Payments
    Composition --> Cart
    Composition --> Orders
    Composition --> PublicCommerce
    Composition --> Platform
    Authorization --> IdentityContract
    Identity --> Platform
    Authorization --> Platform
    Identity --> IdentityContract
    Authorization --> AuthorizationContract
    Catalog --> CatalogContract
    Pricing --> CatalogContract
    Inventory --> CatalogContract
    PublicCommerce --> CatalogContract
    PublicCommerce --> Pricing
    PublicCommerce --> Inventory
    Shipping --> Pricing
    Orders --> CatalogContract
    Orders --> Pricing
    Orders --> Inventory
    Orders --> Shipping
    Orders --> Payments
    Cart --> CatalogContract
    Cart --> Pricing
    Cart --> Inventory
    Cart --> Shipping
    Orders --> Cart
```

The composition root may know all concrete modules. Platform facilities do not
import business modules. Authorization consumes Identity only through
Identity's public contract, except for the private persistence-only foreign-key
metadata described below.

Public Commerce owns no tables and performs no authoritative calculations. It
composes published Catalog facts with optional Pricing projections and
quantity-free Inventory availability through those modules' public contracts.
Missing Price or Inventory configuration produces a non-purchasable public
projection; Orders still revalidate the authoritative modules during checkout.

## Cross-module authorization transaction

Privilege changes require Authorization state, its audit record, and Identity's
authentication version to commit or roll back together.

```mermaid
sequenceDiagram
    participant A as Authorization application service
    participant T as DatabaseTransactionRunner
    participant AP as Authorization persistence
    participant I as Identity public contract
    participant IP as Identity persistence
    participant DB as PostgreSQL

    A->>T: run(work)
    T->>DB: begin
    T-->>A: opaque transaction context
    A->>AP: mutate staff/roles/audit(context)
    AP->>DB: Authorization-owned writes
    A->>I: incrementAuthenticationVersion(context)
    I->>IP: Identity-owned operation
    IP->>DB: Identity-owned write
    T->>DB: commit or rollback all
```

Application code receives no TypeORM `EntityManager`, repository, or entity.
The manager is held in a private infrastructure `WeakMap` and may be unwrapped
only by platform database code and module persistence implementations.

## Foreign-key metadata exception

Authorization stores scalar Identity user IDs. TypeORM development/test schema
synchronization still requires Identity entity metadata to create deliberate
PostgreSQL foreign keys.

The only permitted deep Identity persistence import is:

```text
modules/authorization/data/identity-user-foreign-key.persistence.ts
```

It is not publicly exported or used for business reads/writes. Associated ORM
relations are private, non-eager, non-lazy, and non-cascading. Automated
architecture tests enforce this exception and reject additional deep imports.

## Runtime data boundaries

- PostgreSQL is authoritative for Identity, Authorization, and commerce state.
- Redis is authoritative for opaque sessions and distributed abuse-protection
  counters.
- Every merchant deployment has its own PostgreSQL, Redis, secrets, and
  operational lifecycle.
- There is no tenant resolver or shared cross-store runtime data.

## When to update this document

Update this map when:

- a real business module or platform facility is introduced or removed;
- a Module Public Contract changes shape;
- transaction ownership or dependency direction changes through an accepted
  decision;
- a persistence-only boundary exception is added or removed;
- the deployment topology changes.

Do not update this living document to describe planned code as if it already
exists.
