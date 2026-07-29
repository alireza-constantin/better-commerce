# Catalog Navigation Contract

Status: Approved implementation contract  
Scope: ADR-0017 Categories, Collections, and Catalog Navigation  
Version: 1.0  
Date: 2026-07-29  
Authority: `docs/adr/0017-categories-collections-navigation.md`

## 1. Purpose and authority

This contract defines the observable Category and Collection increment for one
independent store deployment. It supplements the initial Catalog contract; it
does not rewrite Product, Variant, Pricing, Inventory, Cart, Order, or Product
media behavior.

Catalog remains the sole authority over every definition, slug reservation,
hierarchy edge, membership, and position described here.

## 2. Fixed limits

| Resource | Limit |
| --- | ---: |
| Categories per deployment | 500 |
| Category hierarchy depth, root included | 5 |
| Category memberships per Product | 20 |
| Collections per deployment | 500 |
| Products per Collection | 1,000 |
| Title | 160 characters |
| Slug | Existing Catalog slug limit and grammar |
| Summary | 500 characters |
| Plain-text description | 10,000 characters |
| Cursor-paginated page size | Default 25, maximum 100 |

Limits are checked before persistence. Exceeding a limit returns
`catalog.validation_failed`.

## 3. Category contract

### 3.1 Administrative Category

| Field | Contract |
| --- | --- |
| `id` | Immutable UUID |
| `version` | Positive optimistic-concurrency version |
| `status` | `active` or `archived` |
| `title` | Required trimmed text |
| `summary` | Nullable trimmed plain text |
| `description` | Nullable plain text |
| `slug` | Current normalized canonical Category slug |
| `parentId` | Nullable Category UUID |
| `position` | Contiguous zero-based position among siblings |
| `aliases` | Historical normalized slugs, administrative reads only |
| `archivedAt` | Nullable UTC instant |
| `createdAt` | UTC instant |
| `updatedAt` | UTC instant |

Creating a Category creates it as `active` with version `1`. `parentId = null`
creates a root. The requested position may be from zero through the current
sibling count; affected siblings shift atomically.

Editing title, summary, description, or slug requires `expectedVersion`.
Changing the slug retains the previous canonical slug as a historical alias.
Editing does not move the Category.

Moving requires `expectedVersion`, the complete desired `parentId`, and the
desired sibling `position`. Catalog shifts affected old and new siblings
atomically. The moved Category increments exactly once. Incidental position
shifts do not represent edits to sibling identity or merchandising fields and
do not increment sibling versions.

### 3.2 Hierarchy behavior

A hierarchy command rejects:

- self-parenting;
- moving beneath a descendant;
- any cycle;
- a resulting path or descendant path deeper than five;
- an active Category beneath an archived parent;
- archival while any direct or indirect descendant is active;
- restoration while any ancestor is archived;
- a position outside the resulting sibling range.

Hierarchy validation and mutation occur in one Catalog transaction. A stale
Category version returns `catalog.version_conflict` before any tree change.

### 3.3 Category memberships

Replacing Product Category membership accepts:

```json
{
  "expectedVersion": 4,
  "categoryIds": ["uuid"]
}
```

The array is the complete desired set. It contains at most twenty unique,
existing Category UUIDs. Administrative assignment to an archived Category is
allowed so classification can be prepared before restoration.

The command atomically adds and removes memberships and increments Product
version exactly once. A stale Product version changes nothing. Membership has
no Category-specific Product position.

### 3.4 Category public projection

Navigation returns a flat, ordered list of at most 500 active Categories:

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Clothing",
      "slug": "clothing",
      "parentId": null,
      "position": 0
    }
  ]
}
```

The combination of `parentId` and `position` is sufficient for a storefront to
build a tree. Product lists are not embedded.

Category detail exposes ID, title, summary, description, canonical slug, and an
ordered root-to-current breadcrumb list. It excludes version, aliases,
archival timestamps, and administrative membership.

An active Category remains publicly resolvable when it has zero published
Products. Category Product reads expose only ordinary public Product
projections and use the existing deterministic published-Product cursor order.

## 4. Collection contract

### 4.1 Administrative Collection

| Field | Contract |
| --- | --- |
| `id` | Immutable UUID |
| `version` | Positive optimistic-concurrency version |
| `status` | `active` or `archived` |
| `title` | Required trimmed text |
| `summary` | Nullable trimmed plain text |
| `description` | Nullable plain text |
| `slug` | Current normalized canonical Collection slug |
| `aliases` | Historical normalized slugs, administrative reads only |
| `products` | Complete ordered membership as Product ID and position |
| `archivedAt` | Nullable UTC instant |
| `createdAt` | UTC instant |
| `updatedAt` | UTC instant |

Creating a Collection creates an empty `active` Collection at version `1`.
Editing merchandising fields or slug requires `expectedVersion`. Slug changes
retain the previous canonical value as an alias.

### 4.2 Ordered Collection membership

Replacing Collection Products accepts:

```json
{
  "expectedVersion": 3,
  "items": [
    { "productId": "uuid", "position": 0 }
  ]
}
```

The array is the complete desired membership. It must contain:

- at most 1,000 entries;
- unique existing Product IDs;
- unique, contiguous positions starting at zero.

Draft, published, and archived Products may be retained administratively.
Replacement is atomic and increments Collection version exactly once.

Public Collection Product reads preserve stored membership order while
filtering out Products not currently in the Published Catalog. Filtering does
not rewrite stored positions. Pagination uses the tuple `(position, productId)`
and does not expose gaps.

### 4.3 Collection public projection

Public Collection list/detail exposes ID, title, summary, description, and
canonical slug. It excludes version, aliases, membership for hidden Products,
and archival metadata.

An active empty Collection remains publicly listable and resolvable.

## 5. Lifecycle and slug resolution

Category and Collection transitions are:

```text
active -> archived
archived -> active
```

Every transition requires `expectedVersion` and increments version exactly
once. Repeating an already-completed transition is a conflict, not a successful
idempotent operation.

Category and Collection slug namespaces are distinct from each other and from
Products. Canonical slugs and aliases share one uniqueness namespace within
their entity type.

For an active definition:

- a canonical slug returns the definition with
  `requestedSlugIsCanonical = true`;
- a historical alias returns the definition, current `canonicalSlug`, and
  `requestedSlugIsCanonical = false`.

Unknown and archived definitions return the same public `404` representation.
Aliases and canonical slugs remain reserved after archival.

## 6. HTTP contract

All administrative routes require a valid staff session, `admin.access`, their
listed permission, trusted-origin validation, and CSRF on mutations.

### 6.1 Administrative routes

| Method and route | Permission | Result |
| --- | --- | --- |
| `GET /api/v1/admin/catalog/categories` | `catalog.categories.read` | Cursor-paginated/filterable Category list |
| `POST /api/v1/admin/catalog/categories` | `catalog.categories.write` | Create active Category |
| `GET /api/v1/admin/catalog/categories/:categoryId` | `catalog.categories.read` | Category detail |
| `PATCH /api/v1/admin/catalog/categories/:categoryId` | `catalog.categories.write` | Edit fields and slug |
| `POST /api/v1/admin/catalog/categories/:categoryId/move` | `catalog.categories.write` | Move/reorder Category |
| `POST /api/v1/admin/catalog/categories/:categoryId/archive` | `catalog.categories.write` | Archive leaf Category |
| `POST /api/v1/admin/catalog/categories/:categoryId/restore` | `catalog.categories.write` | Restore Category |
| `PUT /api/v1/admin/catalog/products/:productId/categories` | `catalog.products.write` | Replace Product Category set |
| `GET /api/v1/admin/catalog/collections` | `catalog.collections.read` | Cursor-paginated/filterable Collection list |
| `POST /api/v1/admin/catalog/collections` | `catalog.collections.write` | Create active Collection |
| `GET /api/v1/admin/catalog/collections/:collectionId` | `catalog.collections.read` | Collection detail |
| `PATCH /api/v1/admin/catalog/collections/:collectionId` | `catalog.collections.write` | Edit fields and slug |
| `PUT /api/v1/admin/catalog/collections/:collectionId/products` | `catalog.collections.write` | Replace ordered Products |
| `POST /api/v1/admin/catalog/collections/:collectionId/archive` | `catalog.collections.write` | Archive Collection |
| `POST /api/v1/admin/catalog/collections/:collectionId/restore` | `catalog.collections.write` | Restore Collection |

Admin list query supports optional `status`, title/slug prefix `q`, `cursor`,
and bounded `limit`. Default ordering is `(updatedAt DESC, id DESC)`.

### 6.2 Public routes

| Method and route | Result |
| --- | --- |
| `GET /api/v1/catalog/categories/navigation` | Complete bounded active navigation |
| `GET /api/v1/catalog/categories/:slug` | Resolve active Category |
| `GET /api/v1/catalog/categories/:slug/products` | Published Products in Category |
| `GET /api/v1/catalog/collections` | Cursor-paginated active Collections |
| `GET /api/v1/catalog/collections/:slug` | Resolve active Collection |
| `GET /api/v1/catalog/collections/:slug/products` | Published Products in stored order |

`navigation` is a reserved Category route token and cannot be written as a
Category canonical slug or alias. Existing configured Catalog reserved routes
also apply.

Public Product pages reuse the public Product response and availability/price
composition. Category and Collection endpoints do not calculate or persist
commerce state.

## 7. Error contract

| Condition | Status | Code |
| --- | ---: | --- |
| Invalid text, ID set, position, cursor, or limit | `400` | `catalog.validation_failed` |
| Unknown Category in Admin | `404` | `catalog.category_not_found` |
| Unknown Collection in Admin | `404` | `catalog.collection_not_found` |
| Unknown or hidden public definition | `404` | `catalog.not_found` |
| Category slug/alias collision | `409` | `catalog.category_slug_conflict` |
| Collection slug/alias collision | `409` | `catalog.collection_slug_conflict` |
| Cycle, depth, ancestry, move, or active-descendant violation | `409` | `catalog.category_hierarchy_conflict` |
| Invalid Category lifecycle transition | `409` | `catalog.category_transition_conflict` |
| Invalid Collection lifecycle transition | `409` | `catalog.collection_transition_conflict` |
| Duplicate/unknown/invalid membership replacement | `409` | `catalog.membership_conflict` |
| Stale Category, Collection, or Product version | `409` | `catalog.version_conflict` |

Conflict responses include `currentVersion` only when one authoritative
aggregate version exists and disclosing it is appropriate for the authenticated
administrative caller. Public errors never include it.

## 8. Audit contract

Successful administrative mutations record these Commerce Audit actions in the
same database transaction:

- `catalog.category_created`;
- `catalog.category_updated`;
- `catalog.category_moved`;
- `catalog.category_archived`;
- `catalog.category_restored`;
- `catalog.product_categories_replaced`;
- `catalog.collection_created`;
- `catalog.collection_updated`;
- `catalog.collection_archived`;
- `catalog.collection_restored`;
- `catalog.collection_products_replaced`.

Audit targets use Category, Product, or Collection UUIDs. Metadata is
allow-listed and contains only counts, positions, and applicable parent UUIDs.
It contains no titles, descriptions, full request bodies, cookies, session
identifiers, or credentials.

## 9. Authorization assignment

| Role | Category permissions | Collection permissions |
| --- | --- | --- |
| `owner` | read, write | read, write |
| `administrator` | read, write | read, write |
| `catalog_manager` | read, write | read, write |
| `marketing_manager` | read | read, write |
| `analyst` | read | read |
| `order_manager` | none | none |
| `support_agent` | none | none |

Owner receives every defined permission through the existing catalogue rule.
Administrator still excludes only owner-assignment authority.

## 10. Security and validation

- Slugs use the existing deterministic normalization and reserved-route rules.
- IDs, membership arrays, positions, text lengths, query fields, and page sizes
  are validated server-side.
- Plain text is untrusted at renderer boundaries and never interpreted as
  executable HTML.
- Administrative existence is not leaked through public resolution.
- Query values are parameterized; user-provided sort columns are not accepted.
- No endpoint accepts arbitrary filter JSON, rule JSON, SQL fragments, storage
  URLs, or renderer components.
- Logs and errors exclude full request bodies and sensitive platform data.

## 11. Required verification

Implementation is incomplete until focused checks prove:

1. cycle, self-parent, depth, and archived-ancestor rejection;
2. atomic Category moves and contiguous sibling order;
3. leaf-first archival and valid restoration;
4. separate Category/Collection/Product slug namespaces;
5. alias reservation and canonical resolution after slug changes;
6. archive retention without public disclosure;
7. atomic Product Category replacement and one Product version increment;
8. atomic ordered Collection replacement and one Collection version increment;
9. hidden Products are filtered without mutating Collection order;
10. active empty definitions remain public;
11. stale versions change nothing;
12. exact permission enforcement and role assignment;
13. CSRF and trusted-origin enforcement on every mutation;
14. transactional allow-listed audit records;
15. bounded deterministic pagination and navigation;
16. generated OpenAPI and SDK contract accuracy;
17. no Catalog entity, repository, or ORM type crosses the module boundary.

## 12. Deferred capabilities

This contract does not authorize multi-parent taxonomy, tags, Attributes,
facets, dynamic Collections, scheduled campaigns, localization, Category or
Collection media, nested Collections, CMS content, advanced search, bulk
import/export, deletion, or slug reuse.

