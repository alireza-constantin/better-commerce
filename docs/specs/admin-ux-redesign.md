# Admin UX Redesign

Status: Accepted for implementation

Date: 2026-08-14

Scope: `apps/admin` and the supporting Admin API contracts required by its workflows

## 1. Purpose

Better Commerce Admin is a Persian, RTL-first workspace for non-technical store
employees. The redesign must make daily operations safer, faster, and visually
coherent across the whole application. Visual polish supports those outcomes; it
does not replace clear workflows, reliable server state, or safe mutation rules.

The implementation retains the architectural constraints in ADR-0010: typed
TanStack Router routes, TanStack Query server state, source-owned shared UI
modules, exact permission gates, generated clients, explicit failure handling,
and no metadata-driven generic CRUD framework.

## 2. Product principles

In priority order, the Admin must:

1. prevent accidental or silent destructive changes;
2. reduce the time required to complete common store operations;
3. provide a calm, professional, consistent visual experience;
4. remain understandable without API, UUID, database, or developer knowledge;
5. work across desktop, tablet, and phone layouts;
6. expose technical detail only as optional support information.

The first operational priority is product discovery and editing, followed by
orders, urgent-work visibility, cross-product pricing and inventory, and the
remaining administrative capabilities.

## 3. Experience foundation

### 3.1 Visual language

- Use calm neutral surfaces with a restrained deep blue/teal accent.
- Express the accent, semantic states, spacing, typography, elevation, radius,
  and motion through replaceable design tokens. Changing the brand accent must
  not require editing feature modules.
- Reserve green for success, amber for warnings, and red for destructive or
  failed states.
- Deliver a polished light theme first. Token interfaces must not prevent a
  later dark theme, but dark-mode implementation is out of scope.
- Display `Better Commerce` with a clean `B` monogram until a separate logo is
  supplied. The shell must provide one clear replacement seam for brand assets.

### 3.2 Typography and localization

- IranSans is the primary Persian UI font. Only licensed files supplied by the
  repository owner may be committed or distributed.
- The Admin must declare one documented local font asset location and retain a
  safe system-font fallback while assets are absent.
- Use Persian numerals for ordinary counts and displayed dates.
- Use Jalali dates in primary staff-facing presentation, with the exact instant
  available where operationally useful.
- Preserve Latin, LTR presentation for SKU, UUID, email, request ID, tracking
  code, and similar technical values.
- Display grouped money values with their configured currency. Never silently
  convert rial to toman.
- Copy must use concise, plain, professional Persian and familiar merchant
  terminology. Raw server, SQL, stack, or transport messages never appear in
  customer-facing UI.

### 3.3 Responsive behavior

- All capabilities remain usable on desktop, tablet, and phone.
- Desktop uses compact operational tables where comparison matters.
- Phone layouts use task-focused cards or detail views instead of forcing wide
  desktop tables into horizontal scrolling.
- Complex product editing is optimized for desktop and tablet without making
  essential mobile actions unavailable.
- The desktop sidebar is collapsible and remembers its preference locally.
- Mobile navigation uses an accessible modal drawer with backdrop, focus
  containment, Escape handling, and focus restoration.

### 3.4 Accessibility

Every slice targets WCAG 2.2 AA and includes:

- semantic landmarks, headings, labels, table headers, and descriptions;
- keyboard operation and visible focus;
- field-linked validation using `aria-invalid` and error descriptions;
- sufficient contrast and non-colour status communication;
- reduced-motion support;
- predictable focus after navigation, dialogs, mutations, and failures;
- screen-reader announcements for async results where appropriate.

## 4. Application information architecture

The permission-filtered navigation is grouped as:

1. **Overview**
2. **Sales** — Orders
3. **Products** — Catalogue, Categories, Collections
4. **Operations** — Pricing, Inventory, Shipping
5. **Team and security** — Staff, Access audit, Commerce activity

Existing URLs, bookmarks, typed route contracts, permission checks, and audit
behavior remain compatible during the redesign.

Global search is reachable from every screen through a visible control and an
optional keyboard shortcut. Its initial scope is Products, Variants/SKUs, and
Orders. Results and actions are permission-aware. Categories, Collections,
customers, and staff are added only when reliable search contracts exist.

## 5. Shared interaction model

### 5.1 Lists and details

Products, Orders, Pricing, Inventory, and Staff share a consistent model:

- URL-backed search, filters, selected identifiers, and stable view state;
- cursor pagination without invented totals or page numbers;
- compact desktop tables and mobile cards;
- explicit loading, empty, permission, failure, and recovery states;
- dedicated detail routes for editing and consequential actions;
- optional side panels for lightweight inspection only.

The UI must respect each server contract's allow-listed filters and sorting.

### 5.2 Saving and unsaved work

- Saves are explicit and section-level.
- Each domain uses its real mutation boundary; the browser does not pretend
  separate API mutations are one transaction.
- Dirty-state indicators identify unsaved sections.
- Navigation and refresh warn about unsaved work.
- Local draft recovery may restore form work after an accidental refresh, but
  it never writes server state automatically.
- Duplicate submissions are disabled.
- Returned server representations become authoritative after a successful save.

ADR-0005 optimistic version protection remains authoritative. A stale save must
return a conflict, refresh current state, and require staff review; latest-save
silent overwrites are rejected. The conflicting last-write-wins wording in the
visual variant editor specification must be amended before that specification
is treated as implementation-complete.

### 5.3 Feedback and confirmation

- Validation appears beside the affected field, plus a summary when several
  fields fail.
- Loading and service failures use inline recovery panels.
- Short, non-critical success results use notifications.
- Long operations retain visible progress.
- Conflicts explain that newer data exists and provide refresh/review recovery.
- Native browser `alert` and `confirm` are not used.

Confirmation has three levels:

1. no confirmation for ordinary reversible saves;
2. review dialog for prices, stock, publishing, archiving, and bulk operations;
3. typed confirmation for rare permanent deletion.

## 6. Dashboard

The Overview is a permission-aware operational work queue, not a decorative
metrics page. It prioritizes:

- orders requiring attention;
- low-stock and out-of-stock variants;
- products or variants missing a price, clearly described as a valid state;
- incomplete drafts;
- recent failures or conflicts;
- quick actions and recent activity.

Every count or summary links to the records behind it. The server supplies
authoritative aggregates and actionable results; the browser does not derive
commerce truth from incomplete page data.

Product analytics and employee behavior tracking are out of scope for now.

## 7. Product workspace

Creating a product first creates a minimal draft, then opens its workspace.

The workspace has a persistent product header containing identity, lifecycle,
readiness, dirty state, and permitted primary actions. URL-backed tabs are:

1. **General** — title, summary, description, slug, and lifecycle context;
2. **Categories and collections** — assignments for this product;
3. **Images** — the product media library and variant assignments;
4. **Variants, prices, and inventory** — product configuration and commercial
   operations;
5. **Activity** — the human-readable Product activity timeline.

Each tab preserves separate API save and error boundaries.

### 7.1 Readiness and lifecycle

Publishing uses a readiness checklist that distinguishes:

- actual blockers, such as invalid configuration or no active valid variant;
- recommendations, such as missing descriptive content or images;
- legitimate states, including Price on request and untracked inventory.

Missing price and untracked inventory are never represented as errors.

### 7.2 Media

The media experience is redesigned around the Product-owned library:

- drag-and-drop selection and accessible file selection;
- upload, processing, completion, and recoverable failure states;
- sortable gallery thumbnails and primary-image selection;
- inline alternative text;
- assignment of library images to variants;
- full gallery visibility while a selected variant changes the hero preview to
  its first assigned image, falling back to the Product primary image.

Uploads begin only after the draft Product exists. Supporting API contracts must
resolve variant media ownership, assignment, cleanup, and concurrency before the
UI claims those operations are complete.

### 7.3 Variant workspace

The Admin never exposes raw configuration JSON. Option and value forms feed a
preview helper; staff select and edit the combinations that will be persisted.
The helper must not force a full Cartesian matrix.

The desktop matrix shows variant/options, image, SKU, lifecycle, price state,
inventory state, and row actions. Less common controls use a focused side panel.
Phone layouts use searchable variant cards and focused editing.

The current product sizes do not justify row virtualization. The interface may
remain extensible, but large-scale rendering machinery is out of scope.

Supported reviewed bulk operations are:

- activate or archive;
- assign images;
- set, replace, or withdraw prices;
- configure inventory tracking;
- adjust stock with the required reason;
- safe SKU pattern changes.

Variant configuration remains an atomic Product replacement. Pricing and
Inventory remain independent domains and independent transactions.

## 8. Pricing and inventory

Price and inventory are variant-level data. They are visible beside variants in
the Product workspace and edited only through their owning domain contracts.

The standalone Pricing and Inventory screens become cross-product operational
workspaces with search, filters, missing/not-configured states, bulk selection,
review, and direct navigation to the affected Product. Normal workflows never
require staff to paste a UUID.

### 8.1 Pricing

- Money remains an exact decimal string; the browser never uses floating-point
  arithmetic for authoritative values.
- Price replacement remains immutable and retains history.
- A confirmed withdrawal operation closes the current price and returns the
  variant to Price on request while preserving history.
- Multi-variant price commands require an all-or-nothing batch contract.

### 8.2 Inventory

- Inventory presents `tracked`, `untracked`, and `not_configured` distinctly.
- Untracked never displays a fake infinite number.
- A real quantity of `9999` means exactly 9,999 units.
- Stock adjustment requires a reason and preserves its ledger/audit history.
- Multi-variant inventory commands require an all-or-nothing batch contract.

## 9. Orders and remaining operations

Orders use a searchable operational list with quick inspection and a stable
detail route. Consequential actions remain on the detail page, which presents a
status timeline, customer and delivery information, order lines, payment,
fulfillment actions, notes, and activity.

Categories and Collections remain dedicated workspaces for hierarchy, ordering,
membership, and lifecycle while also being assignable from a Product tab.

Authorization and commerce audit screens lead with human-readable actor, action,
resource, time, and outcome. Technical identifiers and raw metadata are
secondary expandable support details.

## 10. Supporting API work

The redesign includes the backend contracts required for honest workflows:

- permission-aware global search;
- dashboard work queues and authoritative summaries;
- searchable cross-product Pricing and Inventory projections;
- all-or-nothing batch Pricing commands;
- all-or-nothing batch Inventory commands;
- immutable Price withdrawal;
- Product media-library and Variant assignment operations;
- any missing human-readable audit projection fields.

For each capability, implementation order is:

1. contract and server tests;
2. generated client and shared adapter;
3. Admin query/mutation module;
4. UI workflow and browser verification.

## 11. Shared UI module seams

The foundation exposes a small set of deep modules so behavior and accessibility
remain local rather than duplicated by feature pages:

- form field and validation presentation;
- status badge and exact-value presentation;
- loading, empty, permission, failure, and retry states;
- notification and persistent operation progress;
- modal/review/typed-confirmation dialogs;
- responsive data table and mobile-card composition;
- page header, section header, and action layout;
- navigation shell and global search trigger.

Feature modules own domain copy, permission decisions, server state, and
mutation orchestration. Shared UI modules do not know commerce permissions,
Product rules, Price rules, or Inventory rules.

## 12. Verification and acceptance

The Admin test foundation includes:

- Vitest and React Testing Library for module and workflow tests;
- Mock Service Worker for server states;
- Playwright for critical browser journeys;
- automated accessibility checks;
- desktop, tablet, and phone screenshot baselines.

A slice is complete only when:

- Persian RTL and the licensed-font contract are correct;
- desktop, tablet, and phone layouts are verified;
- keyboard and screen-reader operation is verified;
- loading, empty, validation, permission, conflict, and service-failure states
  are covered;
- ordinary staff workflows contain no avoidable UUID entry;
- scoped tests, accessibility checks, type-check, lint, build, and critical
  browser journeys pass;
- the slice is committed and pushed independently.

Target workflow timings are:

- find a Product or Order within 10 seconds;
- change one Variant price or stock state within 30 seconds;
- complete a normal Product edit within 60 seconds;
- complete a common Order action within 60 seconds;
- provide immediate interaction feedback while server work continues.

## 13. Delivery roadmap

### Slice 0 — Specification

Accept this specification and use it as the source of truth for subsequent
slices.

### Slice 1 — Foundation and coded prototype

- semantic tokens and licensed-font contract;
- shared UI modules;
- responsive, collapsible shell and reorganized navigation;
- global-search trigger shell;
- test, accessibility, browser, and screenshot harnesses;
- production-connected shell, Overview frame, Product list, and Product
  header/tab prototype;
- correct the existing Variant matrix column/content mismatch.

### Slice 2 — Product discovery and workspace

- Product search/list states;
- draft creation;
- persistent Product header and URL-backed tabs;
- General and Categories/Collections section saves;
- dirty state, draft recovery, and conflict recovery.

### Slice 3 — Product media and variants

- media contract amendments and implementation;
- redesigned Product gallery;
- Variant media assignment;
- structured options and combination preview;
- responsive Variant matrix/cards and reviewed bulk operations.

### Slice 4 — Orders

- operational Order list and responsive presentation;
- quick inspection and stable details;
- lifecycle actions, confirmations, feedback, and activity.

### Slice 5 — Dashboard and global search

- server projections and permission filtering;
- actionable Overview work queues;
- Product, Variant/SKU, and Order global search.

### Slice 6 — Cross-product Pricing and Inventory

- searchable projections;
- Price withdrawal;
- all-or-nothing batch contracts;
- reviewed cross-product workflows;
- removal of normal UUID-paste interactions.

### Slice 7 — Catalogue navigation and Shipping

- Categories and Collections workspaces;
- hierarchy, ordering, membership, and lifecycle UX;
- Shipping workflow consistency and responsive redesign.

### Slice 8 — Team and audit

- Staff management consistency;
- human-readable authorization and commerce activity;
- secondary technical detail and support identifiers.

### Slice 9 — System hardening

- cross-screen responsive and accessibility audit;
- performance and bundle review;
- complete screenshot baselines;
- copy and localization consistency;
- remove superseded UI implementations and update architecture maps.

## 14. Explicit non-goals

- employee behavior analytics;
- dark-mode delivery in the initial redesign;
- a generic metadata-driven CRUD framework;
- automatic server autosave;
- silent last-write-wins conflict handling;
- fake infinite inventory quantities;
- arbitrary Product filters or sorting unsupported by server contracts;
- premature Variant-row virtualization;
- redesigning the Better Commerce brand or logo.
