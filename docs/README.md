# Better Commerce Documentation

This directory separates decisions, the current system description, behavioral
contracts, contributor practices, operational runbooks, and temporary plans.
Each layer has a different owner and update lifecycle.

## Documentation map

### Architecture Decision Records

ADRs explain why a durable architectural decision was made, the alternatives
considered, its consequences, and the invariants implementation must preserve.
Accepted ADRs are historical records. Change them only through an explicit
amendment or a superseding ADR.

- [ADR-0001 — Platform Architecture Principles](adr/0001-platform-principles.md)
- [ADR-0002 — Repository and Workspace Boundaries](adr/0002-monorepo.md)
- [ADR-0003 — Backend Module Architecture](adr/0003-backend.md)
- [ADR-0004 — Commerce Domain Model](adr/0004-commerce-model.md)
- [ADR-0005 — Catalog, Products, and Variants](adr/0005-catalog.md)
- [ADR-0006 — Orders and Historical Purchase State](adr/0006-orders.md)
- [ADR-0007 — Exact Money and Pricing](adr/0007-pricing.md)
- [ADR-0008 — Inventory and Reservations](adr/0008-inventory.md)
- [ADR-0010 — Admin Application Architecture](adr/0010-admin.md)
- [ADR-0011 — Storefront Rendering and Integration Architecture](adr/0011-storefront.md)
- [ADR-0012 — Storefront Source Distribution and Upgrade Workflow](adr/0012-storefront-source-distribution.md)
- [ADR-0013 — Shipping Methods, Zones, and Rate Rules](adr/0013-shipping.md)
- [ADR-0014 — Manual Payments and Admin Order Acceptance](adr/0014-manual-payments.md)
- [ADR-0015 — Persistent Cart Ownership, Merge, and Concurrency](adr/0015-cart.md)
- [ADR-0016 — Product Media and Asset Delivery](adr/0016-product-media.md)
- [ADR-0017 — Categories, Collections, and Catalog Navigation](adr/0017-categories-collections-navigation.md)
- [ADR-0018 — Promotions and Discounts](adr/0018-promotions-and-discounts.md)
- [ADR-0019 — Customers, Wishlists, and Customer Communications](adr/0019-customers-wishlists-and-communications.md)

Proposed decisions under review:

- None.

### Product requirements

Product requirements describe approved user outcomes, workflows, scope, and
acceptance scenarios. They defer architecture and behavioral authority to the
linked ADRs and contracts.

- [Phase 8 Customers, Wishlists, and Customer Communications](prd/phase-8-customers-wishlists-and-communications.md)

### Living architecture

Architecture documents explain how the currently implemented system fits
together. They are updated when code structure, dependency direction, runtime
flow, or deployment topology changes.

- [Backend module map](architecture/module-map.md)
- [Admin application map](architecture/admin-application.md)

### Behavioral contracts

Contracts define observable or security-sensitive behavior that implementations
and tests must preserve. A contract changes through explicit review and, where
external consumers exist, a compatibility/versioning decision.

- [Authorization contract](contracts/authorization.md)
- [Catalog contract](contracts/catalog.md)
- [Catalog navigation contract](contracts/catalog-navigation.md)
- [Commerce operations and audit](contracts/commerce-operations.md)
- [Promotions and discounts](contracts/promotions.md)
- [External HTTP API and SDK](contracts/external-http-api.md)

### Contributor handbook

The handbook explains how contributors work in this repository. Handbook rules
should match executable scripts and automated checks rather than describing an
idealized process.

- [Contributor workflow](handbook/contributor-workflow.md)

### Operational runbooks

Runbooks contain commands and procedures for operating or recovering the
system. Commands must be checked whenever scripts, deployment topology, or
environment requirements change.

- [Local development and authentication operations](runbooks/local-development.md)
- [Admin static delivery](runbooks/admin-static-delivery.md)
- [Production registration security gate](runbooks/release-security-checklist.md)
- [Single-merchant deployment and recovery baseline](runbooks/single-merchant-deployment.md)
- [Public package release](runbooks/public-package-release.md)

### Plans and handoffs

Plans describe bounded implementation work and may become obsolete after
completion. Mark completed plans clearly; do not treat them as architectural
authority.

- [Current continuation brief](plans/continuation.md)
- [Cursor Orders design handoff](plans/cursor-orders-handoff.md)
- [Commerce implementation checkpoint](plans/commerce-implementation-status.md)
- [ADR-0011 reference renderer evaluation](plans/adr-0011-renderer-evaluation.md)
- [ADR-0015 Cart implementation plan](plans/adr-0015-cart-implementation.md)
- [ADR-0017 Categories and Collections implementation plan](plans/adr-0017-implementation.md)
- [ADR-0018 Promotions implementation plan](plans/adr-0018-promotions-implementation.md)
- [Completed ADR-0005 Catalog implementation plan](plans/adr-0005-implementation.md)
- [Completed ADR-0003 implementation plan](plans/adr-0003-implementation.md)

## Authority and conflicts

- An accepted ADR is authoritative for the architectural decision it owns.
- A behavioral contract is authoritative for its observable behavior.
- Living architecture must describe the implementation accurately without
  silently changing an ADR or contract.
- Handbook and runbook instructions must match repository scripts and deployed
  behavior.
- A plan cannot override an ADR or contract.

If two authoritative documents conflict, stop implementation and resolve the
conflict through an amendment, superseding decision, or contract revision.

## Current decision sequence

ADR-0001 through ADR-0008 and ADR-0010 through ADR-0019
are accepted. ADR-0005 Catalog implementation is complete. The first combined
physical-shipping/manual-payment Checkout implementation is present and
typechecks. ADR-0015 Cart, checkout preparation, selectable manual payments,
and the reference customer Order-history flow are implemented.

## Maintenance rules

When a change:

- alters a durable architectural decision, amend or supersede its ADR;
- changes module/runtime topology, update the living architecture;
- changes observable security or API behavior, update the relevant contract and
  tests;
- changes contributor commands, update the handbook and root README;
- changes operational commands or failure recovery, update the runbook;
- completes a plan, mark it completed and refresh the continuation brief.

Prefer links to the owning document over duplicating its rules in several
places. Embed a Mermaid diagram in the document that owns it unless the same
asset has multiple real consumers.
