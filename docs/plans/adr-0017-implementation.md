# ADR-0017 Implementation Plan

Status: In progress — Phase 2 complete
Decision authority: ADR-0017  
Created: 2026-07-29

## Objective

Implement accepted ADR-0017 as one Catalog capability delivered through five
sequential phases:

1. observable contracts and authorization;
2. Catalog domain and persistence;
3. administrative workflows;
4. public SDK and storefront-core integration;
5. reference storefront and final verification.

The work extends the existing Catalog module. It does not create Taxonomy or
Collections services, a CMS, an attribute engine, or a search platform.

No migration files are created during the current disposable-development
workflow. Entity changes require a local database reset before manual runtime
verification.

## Progress

- Phase 1 — Contracts and authorization: completed 2026-07-29
- Phase 2 — Catalog domain and persistence: completed 2026-07-29
- Phase 3 — Administrative workflows: partially implemented; Admin UI deferred
- Phase 4 — Public SDK and storefront-core integration: completed 2026-07-29
- Phase 5 — Reference storefront and final verification: completed 2026-07-29

Phase 1 froze `docs/contracts/catalog-navigation.md`, introduced the distinct
Collection permissions and reviewed role assignments, registered allow-listed
Commerce Audit action contracts, and added transport DTO/error shapes. It
deliberately added no Category or Collection controller, application service,
entity, repository, or UI.

Phase 2 added Catalog-owned Category, slug-history, Product membership,
Collection, slug-history, and ordered membership persistence. It implements
transactional hierarchy and lifecycle commands, membership replacement,
optimistic concurrency, same-transaction Commerce Audit writes, and active-only
module-contract projections. PostgreSQL advisory transaction locks serialize
the bounded Category hierarchy and Collection creation limits. The disposable
development database was reset and synchronized; no migration was added.

Phase 4 exposed active Category navigation, Category and Collection slug
resolution, and scoped published Product reads. Catalog retains membership and
visibility authority; Public Commerce alone enriches those Products with Price
and Inventory. The SDK was regenerated from an isolated local OpenAPI instance,
and storefront-core now exposes framework-neutral server helpers and explicit
cache-key inputs for Categories and Collections.

Phase 5 added the reference storefront's server-rendered Category navigation,
Category pages, Collection list/detail pages, canonical redirects, and Persian
RTL empty and not-found states. Automated live-browser verification remains
intentionally skipped at the user's earlier request.

## Model strategy

Use the least expensive model that can reliably own each phase:

| Phase | Recommended model | Reasoning | Rationale |
|---|---|---:|---|
| 1. Contracts and authorization | `gpt-5.6-terra` | medium | Mostly precise contract and catalogue work with limited algorithmic risk |
| 2. Domain and persistence | `gpt-5.6-terra` | high | Hierarchy cycles, subtree depth, slug aliases, transactions, ordering, and optimistic concurrency require the strongest reasoning in this increment |
| 3. Admin workflows | `gpt-5.6-terra` | medium | Existing Admin patterns constrain the implementation; UI judgment is important but the domain contract is already fixed |
| 4. Public SDK and storefront-core | `gpt-5.6-terra` | medium | Generated-contract propagation and framework-neutral mapping are bounded, mechanical tasks |
| 5. Reference storefront and verification | `gpt-5.6-terra` | medium | Mostly renderer integration, accessibility, RTL behavior, and cross-package verification |

`gpt-5.6-terra medium` is the default cost/power choice. Phase 2 alone should
use Terra High. Escalate a phase to `gpt-5.6-sol medium` only if Terra repeatedly
fails a concrete invariant or produces an unresolved concurrency/boundary
problem; do not begin with Sol by default.

## Agent topology

Run phases sequentially because every later phase consumes contracts or code
from the preceding phase. Parallel agents inside a phase are usually not worth
the merge risk at this repository's current scale.

If agents are delegated, use one owner per phase and require that owner to:

- inspect the accepted ADR and current implementation before editing;
- preserve unrelated working-tree changes;
- avoid `docs/plans/continuation.md`;
- leave a concise handoff describing files, decisions, verification, and
  unresolved issues;
- stop rather than weakening an accepted invariant.

Phase 2 may use one additional read-only reviewer after implementation for
hierarchy and transaction invariants. That reviewer should use
`gpt-5.6-terra high`; it should report findings and not independently rewrite
the same files.

## Phase 1 — Contracts and authorization

Recommended model: `gpt-5.6-terra`, medium reasoning.

### Deliverables

- Extend the Catalog behavioral contract with:
  - Category and Collection shapes;
  - lifecycle and transition behavior;
  - slug/alias resolution;
  - hierarchy and membership limits;
  - optimistic-concurrency wire behavior;
  - deterministic pagination and ordering;
  - stable error codes;
  - administrative and public endpoint shapes.
- Add `catalog.collections.read` and `catalog.collections.write`.
- Review built-in role assignments explicitly instead of granting the new
  permissions to every staff role.
- Add authorization catalogue/audit metadata using existing conventions.
- Define request and response DTOs without persistence details.
- Confirm Category and Collection public routes cannot collide with Product or
  storefront-reserved routes.

### Contract decisions to encode

- Categories: active/archive, parent tree, five-level maximum, leaf-first
  archive, sibling replacement/reordering.
- Product Categories: complete set replacement guarded by Product version.
- Collections: active/archive and complete ordered membership replacement
  guarded by Collection version.
- Public active empty definitions remain resolvable.
- Hidden definitions return the same not-found behavior as unknown ones.

### Exit gate

- Contract document is internally consistent with ADR-0005 and ADR-0017.
- Authorization catalogue validation passes.
- OpenAPI can represent every accepted command and projection.
- No entity, repository, or UI implementation is added in this phase.

## Phase 2 — Catalog domain and persistence

Recommended model: `gpt-5.6-terra`, high reasoning.

### Deliverables

- Catalog-owned entities for:
  - Categories and Category slug reservations;
  - Product–Category membership;
  - Collections and Collection slug reservations;
  - ordered Collection membership.
- Application commands for create, edit, move/reorder, archive/restore, slug
  replacement, and membership replacement.
- Public Catalog module-contract projections.
- Database constraints and indexes supporting uniqueness and bounded reads.
- Optimistic concurrency for Category, Collection, and Product membership
  changes.
- Transactional hierarchy validation:
  - no self-parenting;
  - no cycles;
  - maximum resulting subtree depth;
  - active-ancestor rule;
  - leaf-first archive.
- Stable error translation with no raw database/storage disclosure.

### Required implementation properties

- Use UUID identity and scalar foreign keys consistent with existing Catalog
  persistence.
- Historical aliases remain reserved after archive.
- Category and Collection slug namespaces are distinct.
- Category membership replacement increments Product version exactly once.
- Collection membership replacement increments Collection version exactly
  once.
- Reordering cannot transiently violate unique-position constraints.
- Public Collection ordering closes no stored gaps by mutating data.
- Catalog remains the sole table authority.

### Exit gate

- API typecheck and Catalog lint pass.
- Focused domain checks cover cycles, depth, ordering, stale versions, aliases,
  archive/restore, hidden public reads, and membership retention.
- Module-boundary validation finds no new deep imports.
- A disposable local database reset successfully synchronizes the schema.

## Phase 3 — Administrative workflows

Recommended model: `gpt-5.6-terra`, medium reasoning.

### Deliverables

- Persian, RTL Admin routes and navigation for Categories and Collections.
- Category workflow:
  - accessible tree/list presentation;
  - create and edit;
  - move and sibling reorder;
  - archive/restore with leaf-first error explanation;
  - clear empty, loading, error, conflict, and forbidden states.
- Product editor integration for complete Category membership replacement.
- Collection workflow:
  - create and edit;
  - add/remove Products;
  - deterministic Product ordering;
  - archive/restore.
- Permission boundaries for Category and Collection readers/writers.
- TanStack Query keys, invalidation, and mutation behavior following existing
  Admin conventions.

### UI constraints

- Do not add Zustand unless real shared client state appears.
- Do not store server authority in a client state store.
- Do not make drag-and-drop the only ordering mechanism; keyboard-accessible
  move controls are required even if drag-and-drop is later added.
- Do not fetch all Products without a bound. Product selection uses bounded
  search/pagination.
- All visible copy and errors are Persian; code and documentation remain
  English.

### Exit gate

- Admin typecheck and lint pass.
- UI quality detector reports no unresolved findings.
- All mutation controls have loading/disabled, conflict, and recovery behavior.
- Permission-denied users cannot discover write controls.

## Phase 4 — Public API, SDK, and storefront-core

Recommended model: `gpt-5.6-terra`, medium reasoning.

### Deliverables

- Public HTTP reads for:
  - bounded Category navigation tree;
  - Category slug resolution and paginated Products;
  - paginated active Collections;
  - Collection slug resolution and ordered paginated Products.
- Public Commerce composition adds Pricing and Inventory projections without
  transferring authority.
- Regenerated immutable SDK schema.
- Framework-neutral storefront-core types and server helpers.
- Explicit cache metadata/key inputs for navigation, definitions, and
  pagination.
- Canonical slug information for renderer-owned permanent redirects.

### Integration constraints

- No React, Next.js, Astro, TanStack Router, or renderer dependency enters
  storefront-core.
- No inbound header collection is forwarded through public server helpers.
- Public data does not expose optimistic versions, archived memberships, or
  authorization metadata.
- Product Money remains an exact decimal string.
- Cursor ordering remains deterministic when Products become hidden.

### Exit gate

- SDK generation check has no drift.
- SDK and storefront-core typechecks and runtime verification pass.
- Fixture consumers demonstrate both Next and non-Next compatibility.

## Phase 5 — Reference storefront and final verification

Recommended model: `gpt-5.6-terra`, medium reasoning.

### Deliverables

- Reference storefront:
  - Category navigation;
  - Category pages;
  - Collection list/detail pages;
  - Product breadcrumbs;
  - canonical redirects;
  - responsive loading, empty, not-found, and error states.
- Persian and RTL presentation.
- Renderer-owned cache/revalidation choices documented in the reference app.
- Architecture map, Catalog contract, SDK/storefront-core documentation, and
  local runbook updated to match reality.

### Verification

- Whole-workspace typecheck.
- API and Admin lint.
- Generated SDK drift check.
- Storefront-core and SDK verification scripts.
- Focused hierarchy, authorization, public-visibility, alias, ordering, and
  concurrency checks.
- Compose/schema startup after the explicitly authorized disposable local reset.
- UI quality and accessibility inspection.
- `git diff --check`.

Live browser automation remains optional and should be skipped when the user
retains the earlier instruction to skip automated live-browser verification.

### Exit gate

- All five phases are represented in code and living documentation.
- No accepted ADR invariant is weakened.
- No migration files, customer-specific branches, CMS data, dynamic
  Collections, or advanced-search infrastructure were introduced.
- Temporary processes and verification data are cleaned up.
- `docs/plans/continuation.md` remains unchanged unless the user explicitly
  authorizes updating it.

## Recommended execution

Use five agent turns, not five simultaneously running agents:

```text
Phase 1  Terra Medium
   ↓
Phase 2  Terra High
   ↓
Phase 3  Terra Medium
   ↓
Phase 4  Terra Medium
   ↓
Phase 5  Terra Medium
```

This is the best balance for the current repository. Most work is bounded by
accepted contracts; spending a frontier model on every phase would add cost
without proportional benefit. The hierarchy and transaction phase is the one
place where higher reasoning materially reduces architectural risk.
