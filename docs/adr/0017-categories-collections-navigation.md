# ADR-0017 — Categories, Collections, and Catalog Navigation

Status: Accepted and frozen  
Date: 2026-07-29  
Accepted: 2026-07-29  
Frozen: 2026-07-29

## Context

Better Commerce can create, publish, price, stock, display, and sell Products,
but its public Catalog is still a flat Product list. A real storefront needs
merchant-controlled navigation and curated discovery without introducing a
CMS, search cluster, arbitrary tagging system, or customer-specific backend
logic.

ADR-0005 already establishes Category and Collection as Catalog-owned concepts:

- a Category is a hierarchical merchandising classification;
- a Collection is an explicitly curated group of Products;
- Categories form a bounded tree;
- initial Collections are manual and deterministically ordered;
- Catalog is the sole authority over definitions and memberships.

This ADR refines those decisions into a coherent administrative and public
navigation model. It does not change Product, Pricing, Inventory, Cart, Order,
or storefront-content ownership.

## Decision drivers

- Useful catalog discovery for small and medium independent stores
- A model understandable by a solo merchant
- Stable storefront URLs and SEO-safe slug changes
- Deterministic navigation and merchandising order
- Safe hierarchy changes without cycles or ambiguous ancestry
- Bespoke storefront presentation through portable public data
- Bounded PostgreSQL queries at the platform's expected scale
- No premature faceted search, rules engine, or CMS

## Vocabulary

- **Category:** a hierarchical classification used for catalog navigation,
  such as `Clothing → Men → Shirts`.
- **Collection:** a flat, explicitly curated and ordered Product group, such as
  `New arrivals` or `Summer selection`.
- **Category membership:** the classification of a Product into a Category.
- **Collection membership:** a Product's ordered placement in a Collection.
- **Navigation tree:** the public projection of active Categories and their
  ancestry.
- **Canonical slug:** the current public path identifier for one Category or
  Collection.
- **Historical alias:** a previously canonical slug retained for redirect
  resolution.

## Decision

### Catalog owns both concepts

Categories, Collections, their slug reservations, hierarchy, memberships,
ordering, and lifecycle remain inside the existing Catalog module. They are not
new business modules.

Only Catalog may mutate their persistent data. Other backend modules consume
only Catalog's Module Public Contract where a real dependency exists. Public
storefronts consume HTTP and generated SDK contracts.

Categories and Collections do not own Product price, availability, stock,
publication, or purchasing eligibility. Their public Product projections are
composed from the same authoritative Catalog, Pricing, and Inventory facts as
ordinary public Product reads.

### Category model

A Category contains:

- an opaque UUID;
- a positive optimistic-concurrency version;
- `active` or `archived` lifecycle status;
- title;
- optional summary and plain-text description;
- one canonical slug and retained historical aliases;
- an optional parent Category ID;
- a deterministic sibling position;
- UTC creation, update, and archival timestamps.

A Category has at most one parent. The resulting structure is a forest: a store
may have several root Categories, but every non-root Category has one unambiguous
ancestry path.

Category identity is independent of its title, slug, parent, and position.
Moving or renaming a Category never changes its ID.

### Category hierarchy invariants

- Self-parenting and cycles are rejected.
- Maximum hierarchy depth is five Categories, including the root.
- A parent and child belong to the same independent store deployment by
  construction; there is no tenant identifier.
- Sibling positions are unique, contiguous, zero-based, and deterministic.
- Moving a Category moves its complete descendant subtree.
- A move is rejected if the resulting subtree exceeds the depth limit.
- An active Category may have only active ancestors.
- Archiving a Category with active descendants is rejected. Descendants must be
  archived first or a future explicit subtree command must perform the change
  atomically.
- Restoring an archived Category returns it to `active` only when all ancestors
  are active.
- Archiving or moving a Category never changes Product lifecycle.

The implementation checks ancestry inside one Catalog transaction. It does not
rely only on UI validation or a cached tree.

### Category membership

A Product may belong to multiple Categories. A Category may contain multiple
Products.

Category membership is classification, not Product ownership and not a
denormalized Product ID array. Membership rows use Product and Category UUIDs
with a uniqueness constraint on the pair.

Changing a Product's Category memberships is a Product-level Catalog command
and increments the Product version. The replacement request contains the
complete desired set, so removal and addition are atomic and stale Admin edits
cannot silently overwrite one another.

Version 1 permits at most twenty Category memberships per Product. It provides
no Category-specific Product ordering. Public Category Product pages use the
ordinary deterministic published-Product order and cursor pagination.

Archived Categories retain administrative memberships, but those memberships
do not appear in public Category projections.

### Collection model

A Collection contains:

- an opaque UUID;
- a positive optimistic-concurrency version;
- `active` or `archived` lifecycle status;
- title;
- optional summary and plain-text description;
- one canonical slug and retained historical aliases;
- UTC creation, update, and archival timestamps.

Collections are flat. They have no parent, nesting, inheritance, or implicit
membership.

Collection membership and position are part of the Collection aggregate because
the merchant curates the Collection as one ordered list. Replacing Collection
membership requires its expected version and the complete ordered Product ID
list. The command is atomic, rejects duplicate Product IDs, and assigns
contiguous zero-based positions.

A Collection may retain draft, unpublished, or archived Products
administratively. Its public projection includes only Products currently
eligible for the Published Catalog, without destroying the retained membership
or closing gaps by mutating stored order.

Version 1 permits at most one thousand Products in a Collection. Large bulk
merchandising or import remains a future bounded workflow.

### Lifecycle

Category and Collection lifecycle is deliberately smaller than Product
lifecycle:

```text
active -> archived
archived -> active
```

New definitions are created as `active`. An active Category or Collection is
publicly resolvable even when it currently contains no published Products.
This keeps lifecycle meaning explicit: `active` controls visibility; Product
count does not silently control it.

Archival:

- removes the definition from public navigation and public resolution;
- retains IDs, slugs, aliases, memberships, and ordering;
- does not archive or unpublish member Products;
- never releases a slug for reuse.

Restoration revalidates current slug, ancestry, and other invariants before the
definition becomes public.

### Slugs, aliases, and routes

Categories and Collections each have their own case-insensitive slug namespace
because their public routes are type-qualified:

```text
/categories/:slug
/collections/:slug
```

A Product, Category, and Collection may therefore share the same slug without
ambiguity. Within one entity type:

- canonical slugs and historical aliases share one uniqueness namespace;
- a slug remains reserved while the entity exists, including after archival;
- changing a canonical slug retains the prior slug as a historical alias;
- resolving a historical alias returns the canonical slug so the storefront
  can issue a permanent redirect;
- draft or archived administrative existence is not disclosed publicly;
- configured reserved-route validation follows Catalog's existing slug rules.

Category URLs do not encode the full ancestor path. Moving a Category therefore
does not invalidate its URL or require redirecting an entire subtree. A
storefront may render breadcrumbs from ancestry data.

### Public navigation and reads

The public Catalog contract provides:

- a complete bounded active Category navigation tree;
- Category resolution by canonical or historical slug;
- cursor-paginated published Products for an active Category;
- cursor-paginated active Collections;
- Collection resolution by canonical or historical slug;
- cursor-paginated published Products in stored Collection order.

The navigation tree is intentionally returned as one bounded projection because
version 1 allows at most five hundred Categories per deployment. It includes
IDs, titles, canonical slugs, parent IDs, and sibling positions. It does not
embed Product lists.

Public Category and Collection detail may include safe merchandising text and
breadcrumbs or ancestry identifiers. It does not include administrative
versions, archived memberships, storage data, or authorization information.

Unknown, archived, and invalid Category or Collection slugs use the same
not-found privacy behavior as hidden Products. Historical aliases resolve only
when the owning definition is active.

### Administrative capabilities

Admin supports:

- listing and searching Categories and Collections;
- creating, editing, archiving, and restoring definitions;
- moving and reordering Categories;
- replacing a Product's Category memberships;
- replacing a Collection's ordered Product membership;
- previewing canonical paths and public visibility.

Every mutation is CSRF-protected, permission-gated, validated, audited through
the existing administrative conventions, and protected by optimistic
concurrency.

Existing Category operations use:

- `catalog.categories.read`;
- `catalog.categories.write`.

Collections receive distinct permissions:

- `catalog.collections.read`;
- `catalog.collections.write`.

Collection authority is not hidden inside promotion permissions, and Category
write permission does not implicitly authorize Collection merchandising.
Roles receive new permissions through the reviewed authorization catalogue;
Owner retains all defined permissions through the existing Owner contract.

### Limits and validation

Initial contract limits are:

- 500 Categories per deployment;
- hierarchy depth of 5;
- 20 Category memberships per Product;
- 500 Collections per deployment;
- 1,000 Products per Collection;
- title length of 160 characters;
- slug length consistent with the existing Catalog slug contract;
- summary length of 500 characters;
- plain-text description length of 10,000 characters;
- bounded Admin and public list page sizes consistent with existing Catalog
  pagination.

Limits are application-contract constants backed by database constraints where
appropriate. They may be raised after measurement without changing ownership
or semantic behavior.

## Storefront responsibility

The platform supplies structured navigation and merchandising data, not a
mandatory UI.

Each independent storefront owns:

- header and mobile-navigation composition;
- whether and where Categories or Collections appear;
- category and collection page layout;
- breadcrumbs and presentation;
- framework-specific caching, streaming, image components, and metadata tags;
- customer-specific static copy surrounding Catalog data.

`storefront-core` may expose framework-neutral projections and request helpers.
It does not ship a required React tree, router, page template, or CMS renderer.

## Explicit non-goals

Version 1 does not include:

- multi-parent Categories, arbitrary graphs, tags, or folksonomies;
- dynamic or rule-based Collections;
- scheduled Collection campaigns;
- personalized Collections or customer segmentation;
- Category-specific manual Product ordering;
- product Attributes, facets, filter definitions, or filter counts;
- Elasticsearch, OpenSearch, Algolia, or another search service;
- drag-and-drop tree virtualization for thousands of Categories;
- localized titles, descriptions, or slugs;
- Category or Collection images;
- nested Collections;
- automatic navigation menus;
- storefront page content or layout stored in the commerce database;
- bulk import/export;
- deletion or slug reuse.

These capabilities require concrete merchant needs and separate contracts. They
must not be approximated with arbitrary JSON rules, comma-separated tags, or
customer-specific backend branches.

## Consequences

### Positive

- Stores gain useful hierarchical and curated discovery without a CMS.
- Category moves preserve URLs because ancestry is not encoded in identity.
- Collection ordering is explicit and explainable.
- Product publication remains the sole authority for Product visibility.
- Archived definitions can be restored without rebuilding memberships.
- Public contracts remain portable across Next.js, Astro, TanStack Start, and
  other renderers.
- PostgreSQL is sufficient for the expected scale.

### Negative

- Category archival must proceed leaf-first until a subtree workflow exists.
- Category and Collection slug history adds persistence and resolution work.
- Complete Collection replacement is bounded but can still be a relatively
  large administrative request.
- Category Product ordering cannot be independently merchandised in version 1.
- An active empty Category or Collection can produce an empty public page.

## Rejected alternatives

### One generic grouping or tag model

Rejected because hierarchy, ancestry, curated ordering, lifecycle, and public
navigation have different invariants. A generic tag table would move those
rules into callers and eventually become an untyped taxonomy engine.

### Store Categories and Collections in storefront source

Rejected because memberships and active visibility are merchant-managed
Catalog truth shared by Admin, APIs, and multiple possible storefront
renderers. Bespoke layout and static surrounding content still belong in the
storefront repository.

### Store page content and navigation configuration in a CMS

Rejected for the current platform. The requirement is commerce discovery, not
arbitrary page composition. A future CMS integration may consume Category and
Collection IDs without owning their business state.

### Encode complete ancestry in canonical Category URLs

Rejected because moving or renaming an ancestor would invalidate every
descendant URL and require a redirect graph. Stable type-qualified slugs are
sufficient; storefronts can display ancestry as breadcrumbs.

### Dynamic Collections in the first version

Rejected because rules require typed Product Attributes, query semantics,
indexing, preview, explainability, and scheduled evaluation. Manual membership
solves the present merchandising need without a hidden rules engine.

### Separate Taxonomy and Collections services

Rejected because Catalog already owns these concepts, expected scale is small,
and separate services would add transactions and operational failure modes
without independent scaling or ownership needs.

## Architectural invariants

An implementation complies only if:

1. Catalog is the sole authority over Category, Collection, slug, hierarchy,
   membership, and ordering state.
2. Categories form a bounded acyclic forest with at most one parent each.
3. Active Categories have only active ancestors.
4. Category identity and URL do not depend on ancestry.
5. Category membership replacement is a versioned Product command.
6. Collections are flat, manual, explicitly ordered aggregates.
7. Collection membership replacement is atomic and versioned by Collection.
8. Archived definitions retain slugs, aliases, memberships, and IDs.
9. Archiving a grouping never changes Product lifecycle.
10. Public grouping pages expose only Published Catalog Products.
11. Historical aliases resolve only to the active owning definition and return
    its canonical slug.
12. Public queries are bounded and deterministic.
13. Category and Collection administration use distinct explicit permissions.
14. No price, stock, availability, cart, order, or customer truth is stored in
    grouping tables.
15. Storefront layout and arbitrary static content remain outside Catalog.

## Implementation sequence after acceptance

1. Freeze the observable Category and Collection HTTP contract, error codes,
   limits, concurrency behavior, and permission catalogue changes.
2. Implement Catalog persistence, hierarchy validation, lifecycle, aliases,
   membership commands, and public module-contract projections.
3. Add authorized RTL Admin Category-tree and Collection merchandising
   workflows.
4. Regenerate the SDK and extend framework-neutral `storefront-core`.
5. Add reference storefront navigation, Category/Collection pages,
   breadcrumbs, and focused verification.

No migration files are required during the current disposable development
phase. Entity changes are applied through development schema synchronization
after resetting local data, consistent with the existing runbook.

## Acceptance criteria before implementation

Review and approve:

- active/archive lifecycle without a draft state;
- five-level hierarchy limit;
- leaf-first Category archival;
- separate slug namespaces and type-qualified public routes;
- Product-versioned Category membership;
- Collection-versioned ordered membership;
- visibility of active empty groupings;
- initial limits;
- distinct Collection permissions;
- explicit non-goals and implementation sequence.

Acceptance authorizes implementation planning. It does not silently authorize
faceted search, dynamic Collections, CMS content, or a new service boundary.

## Related decisions

- ADR-0001 defines platform principles and independent deployments.
- ADR-0003 defines module authority and dependency boundaries.
- ADR-0004 assigns taxonomy and merchandising to Catalog.
- ADR-0005 defines Category and Collection ownership and their initial shape.
- ADR-0010 defines the client-rendered Admin architecture.
- ADR-0011 defines framework-neutral storefront integration.
- ADR-0016 defines Product media ownership and delivery.
