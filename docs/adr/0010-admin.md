# ADR-0010 — Admin Application Architecture

Status: Accepted
Date: 2026-07-26
Accepted: 2026-07-26
Frozen: 2026-07-26

## Context

Better Commerce needs one merchant-facing application for operating each
independently deployed store. The initial Admin surface includes staff and role
visibility, Catalog, Pricing, Inventory, Shipping, Orders, manual-payment
decisions, and audit history.

Admin is part of the shared platform source. It is not a merchant storefront,
customer-specific fork, second backend, CMS, or SaaS control plane. Every store
deployment receives a compatible Admin artifact and connects it to that store's
API, PostgreSQL database, and Redis-backed session system.

ADR-0002 selects React, Vite, TypeScript, and `apps/admin`, and requires Admin to
consume documented external contracts instead of API implementation source.
The external HTTP contract establishes OpenAPI as the contract authority and
`@better-commerce/sdk` as the generated client boundary. The authentication and
authorization contracts establish opaque cookie sessions, CSRF protection,
default-deny administrative endpoints, and permission-based access.

This ADR defines the durable Admin application boundary and client-side
architecture. It deliberately does not define visual styling, individual screen
layouts, or a generic frontend framework for merchant storefronts.

## Decision drivers

- Keep a production-grade Admin understandable to a solo developer.
- Prevent commerce and authorization rules from leaking into browser code.
- Use the generated API contract instead of duplicating transport types.
- Preserve the existing secure session and CSRF model.
- Make permission changes take effect without trusting stale client state.
- Support operational workflows without introducing a general-purpose CMS.
- Keep one Admin codebase for all independently deployed stores.
- Allow feature-by-feature delivery without a global frontend monolith.
- Prefer simple request/response behavior over premature realtime or offline
  infrastructure.

## Decision

### One platform-owned Admin application

`apps/admin` is one fully client-rendered React and Vite single-page application
written in TypeScript. It is an independently buildable static artifact in the
platform monorepo. It does not use server-side rendering, React Server
Components, or a framework server for application rendering.

The initial application stack is:

- TanStack Router for typed client-side routing and URL search state;
- TanStack Query for remote server state;
- shadcn/ui's source-owned component model for Admin presentation primitives;
- Zustand only when a proven client-only state problem cannot be expressed
  cleanly through URL state, local React state, or TanStack Query.

These tools have distinct ownership. Router state does not become a second
query cache, Zustand does not mirror API resources, and shadcn/ui components do
not acquire commerce rules.

The same Admin source is used for every store deployment. A deployment may
provide public runtime configuration such as store display name, logo, locale,
and public API base path. It must not contain merchant-specific business logic,
private secrets, or a customer-specific source fork.

Admin is deployed alongside one store installation. Version 1 has no central
dashboard that can switch between stores and no cross-store identity, data, or
control plane.

### Same-origin browser boundary

Production serves Admin and the API from the same origin. The intended public
shape is:

```text
https://store.example.com/admin/*  -> Admin static application
https://store.example.com/api/v1/* -> Better Commerce API
```

The exact reverse proxy or container that serves the static files is a
deployment detail. The behavioral requirement is that Admin uses relative API
URLs and same-origin cookies in production.

Local development may run Vite on a separate port, but its development proxy
must preserve the production request shape for `/api`. Application code must
not grow a separate credentialed-CORS mode merely for development.

Same-origin deployment reduces cookie and CSRF configuration risk. It does not
remove the API's trusted-origin, CSRF, authentication, or authorization checks.

### The API is the system authority

Admin contains presentation logic, interaction state, and workflow
composition. It does not contain authoritative rules for:

- price calculation;
- stock availability or reservation;
- shipping eligibility or rate selection;
- Order state transitions;
- payment acceptance;
- staff escalation or last-owner protection;
- resource ownership;
- server-side validation.

Admin may prevent obviously invalid input and explain expected behavior, but
the API validates every request and remains authoritative. Client-side checks
are user experience, not security or domain enforcement.

### Generated SDK as the only API type boundary

Admin communicates with the API through `@better-commerce/sdk`. It does not:

- import controllers, providers, entities, repositories, or DTO source from
  `apps/api`;
- maintain handwritten copies of OpenAPI request or response types;
- call undocumented endpoints;
- embed business rules in an alternative client library.

One Admin-owned API adapter configures the generated SDK and owns browser
transport concerns:

- relative API base path;
- `credentials: "include"`;
- CSRF token acquisition and mutation headers;
- RFC 9457 problem-detail normalization;
- request-ID capture;
- abort signals and safe request cancellation;
- the application response to authentication loss.

Feature code consumes this adapter or small feature-specific functions built on
it. It must not create independently configured HTTP clients. The adapter is
not a workspace package because it has one consumer and owns Admin-specific
behavior.

### Session bootstrap and failure behavior

The API's opaque, HttpOnly cookie is the only authenticated session credential.
Admin stores no access token, refresh token, session identifier, password, or
CSRF token in `localStorage`, `sessionStorage`, IndexedDB, URLs, or persisted
client state.

At application bootstrap, Admin resolves the current administrative profile
through the documented Admin profile endpoint. The resulting states are
distinct:

- `401 Unauthorized`: show the login experience and discard protected cached
  state;
- `403 Forbidden`: the user is authenticated but has no active administrative
  access, so show an access-denied experience;
- success: initialize the protected application with the returned staff
  profile and exact effective permissions;
- unavailable or unexpected failure: show a recoverable service-error state,
  not a false login screen.

CSRF tokens are treated as short-lived protocol state and held in memory only.
The API adapter attaches a valid token to protected state-changing requests and
can reacquire one after authentication lifecycle changes. Feature components do
not manage CSRF themselves.

Logout invalidates the server session, clears all protected query state, and
returns the application to the unauthenticated state.

### Permission-driven user experience

Admin uses the exact effective permissions returned by the server to determine
which navigation, routes, fields, and actions it presents. It does not infer
authority from role names such as `owner` or `administrator`.

Permission checks in the browser improve clarity only. Every protected request
is still authorized independently by the API. A hidden button is never a
security boundary.

Protected routes declare their required permission for navigation and
access-denied rendering. Feature actions use the same permission vocabulary.
Unknown permissions are denied by default.

A `403` from an operation is rendered as an authorization result even if the
button was previously visible. This handles revocation, stale tabs, and
concurrent staff changes safely. A privilege-changing operation invalidates
the affected Admin profile and staff data. Existing sessions may receive `401`
after `authVersion` changes and must follow the normal session-loss flow.

### Feature-oriented source ownership

Admin source is organized by application infrastructure and business-facing
features:

```text
apps/admin/src/
  app/
    providers/
    routing/
    shell/
  api/
    client/
    csrf/
    problems/
  features/
    auth/
    catalog/
    pricing/
    inventory/
    shipping/
    orders/
    staff/
    audit/
  components/
  styles/
```

`app` owns composition, routing, application providers, and the authenticated
shell. `api` owns the Admin HTTP adapter. Each feature owns its routes, screens,
queries, mutations, forms, and feature-local presentation.

`components` contains only proven Admin-wide presentation primitives. It does
not become a generic `shared`, `common`, `helpers`, or domain-rules directory.
A component begins feature-local and moves only after real reuse is
demonstrated.

Imports point from application composition toward feature and infrastructure
public entry points. Features do not reach into another feature's internal
files. Cross-feature commerce coordination remains an API responsibility.

### Routing and URL state

Admin uses TanStack Router for fully client-side routing. Routes declare their
permission and search-parameter contracts. Feature routes are lazy-loaded at
feature boundaries so the initial authenticated shell does not require the
entire application bundle.

State that represents navigation belongs in the URL when practical, including
filters, search terms, selected resource identifiers, and stable view options.
Sensitive values and credentials never belong in the URL.

Cursor-paginated API collections remain cursor-paginated in the UI. Admin may
retain an in-memory cursor history to support previous and next navigation. It
must not invent arbitrary page numbers or total counts the API cannot prove.

### State model

Admin distinguishes three kinds of state:

1. **Server state** is remote data returned by the API and is managed through a
   query cache with explicit keys, invalidation, bounded retry, and cancellation.
2. **URL state** represents navigable filters and selections.
3. **Local UI state** represents transient presentation such as an open dialog,
   draft form input, or expanded row.

TanStack Query owns remote server state. React state and focused feature hooks
own ordinary local UI state.

Zustand may be introduced for a concrete cross-route, client-only state problem,
such as a complex unsaved workflow draft or temporary bulk selection that
cannot reasonably live in the URL or a local component. A Zustand store must
not copy Products, Orders, prices, stock, permissions, the current Admin
profile, or other API resources out of TanStack Query. It must not persist
authentication, CSRF, or protected API data.

Redux or another global client-state architecture is not introduced while
these state categories remain sufficient.

Cached server data is never treated as an authorization or commerce authority.
Sensitive query data is removed on logout and authentication loss.

### Forms, mutations, and concurrency

Forms provide immediate usability validation while submitting contract-shaped
values through the SDK. API problem details remain authoritative and are mapped
to form-level or field-level feedback when the contract identifies the field.

Mutation behavior follows these rules:

- prevent accidental duplicate submission while a request is pending;
- require clear confirmation for high-impact staff, price, stock, Order,
  payment, and archival operations;
- render `409 Conflict` as a stale-state or invariant conflict and refresh the
  affected data;
- invalidate only the query families affected by a successful operation;
- display the returned server representation rather than reconstructing it
  from form input;
- preserve the request ID in diagnostic error details.

Optimistic updates are not used for stock adjustments, price changes, Order
decisions, payment decisions, staff suspension, or role assignment. These
operations have authority, audit, or concurrency consequences and update the
UI only after server success.

Optimistic behavior may later be used for low-risk, reversible presentation
state when rollback is unambiguous.

### Exact values and historical facts

Money crosses the Admin boundary as the contract's exact decimal string and
currency. Forms preserve decimal strings, and Admin never uses JavaScript
floating-point arithmetic to calculate authoritative commerce totals.
Formatted display may use locale-aware presentation, but it must not change the
submitted exact value.

Order snapshots and audit events are displayed as historical server facts.
Admin does not recompute old prices, shipping charges, product names, addresses,
or permissions from current configuration.

Dates cross the boundary as contract-defined UTC timestamps. Admin may render
them in the operator's configured locale and time zone while retaining an
unambiguous UTC value in detailed views.

### Error model

The API adapter converts documented problem details into one Admin error model
without discarding the original problem type, HTTP status, field information,
or request ID.

Admin distinguishes at least:

- validation failure;
- unauthenticated session;
- forbidden operation;
- missing resource;
- conflict or stale state;
- rate limiting;
- temporary dependency or service failure;
- unexpected failure.

Screens provide an appropriate retry or recovery action. Raw stack traces,
internal database details, secrets, and unfiltered server payloads are never
rendered. Error messages do not claim a mutation failed when the final outcome
is unknown; the UI refreshes server state before inviting a retry where a
duplicate decision could matter.

### Admin presentation ownership

Admin has one platform-owned design system and interaction language. Merchant
storefront themes do not style Admin, and copied storefront presentation source
is never imported into it.

Admin adopts shadcn/ui through its source-owned component workflow. Selected
components live inside `apps/admin`, can be adapted to the Admin's accessibility
and interaction rules, and are reviewed as application source. This does not
create a public `@better-commerce/ui` package and does not permit business rules
inside presentation primitives.

Public store branding may appear in the Admin shell as configuration, but it
does not create per-merchant Admin code or arbitrary theme extension points.
Operational consistency takes priority over storefront visual identity.

The application is desktop-first but remains usable on common tablet and narrow
viewport sizes. New interaction primitives must support keyboard operation,
visible focus, semantic labeling, sufficient contrast, and accessible error
association. The target is WCAG 2.2 AA for operator workflows.

The initial language may be singular, but layout uses logical CSS properties
and does not encode business behavior in display strings. A translation
framework is introduced only when a real second Admin locale is scheduled.

### Deployment configuration and secrets

The Admin build contains only public configuration. API base paths, public
branding, build version, and optional public observability identifiers may be
injected at build or runtime. Database credentials, Redis credentials, signing
secrets, bootstrap tokens, and service credentials never enter the browser
artifact.

Admin and API versions are released compatibly from the platform monorepo. CI
must verify that the generated SDK is current before building Admin. A deployed
Admin must expose its application version through a non-sensitive diagnostics
surface so support can compare it with the API deployment.

No service worker, offline mutation queue, or background synchronization is
used in version 1. Administrative writes require a confirmed online API
response.

### Performance policy

Performance work is evidence-driven. Initial safeguards are:

- feature-route code splitting;
- bounded API pagination;
- query caching appropriate to operational freshness;
- request cancellation when navigation makes a response obsolete;
- no unbounded collection fetches;
- no duplicate HTTP clients or duplicate profile bootstraps.

Virtualization, prefetching, realtime subscriptions, and advanced cache
persistence are introduced only for a measured workflow.

### Verification boundary

Admin implementation is verified at three levels:

1. Unit tests cover permission predicates, exact-value formatting, error
   normalization, cursor navigation, and other pure policies.
2. Component/integration tests exercise screens against contract-shaped mocked
   HTTP responses, including `401`, `403`, `409`, and problem details.
3. Browser end-to-end tests cover a small set of critical flows against the
   real API, PostgreSQL, and Redis, including login, session loss, protected
   navigation, one representative commerce mutation, and one staff
   authorization mutation.

Tests must prove that a user interface gate never substitutes for API
authorization and that protected cached data is removed when the session ends.
Exact test tools are implementation choices unless adopting one would create a
new architectural boundary.

## Initial feature delivery order

The first implementation proceeds in bounded, deployable slices:

1. Scaffold `apps/admin`, workspace tasks, static build, and same-origin
   development proxy.
2. Add the SDK-backed API adapter, problem normalization, CSRF lifecycle, and
   authentication bootstrap.
3. Add the protected shell, permission-driven navigation, route boundaries,
   loading states, and error states.
4. Implement Orders and manual-payment operations as the first end-to-end
   operational feature.
5. Implement Catalog, Pricing, Inventory, and Shipping through their existing
   contracts.
6. Implement Staff, Roles, authorization audit, and commerce audit views.
7. Complete critical browser verification and production static-asset
   deployment.

Feature delivery may change order when an operational dependency requires it,
but no feature bypasses the shared API adapter, permission model, or generated
contract.

## Invariants

1. Admin is one platform application, not a per-merchant source fork.
2. One Admin instance operates exactly one independently deployed store.
3. Production Admin and API use a same-origin browser boundary.
4. Admin consumes the documented API through `@better-commerce/sdk` and never
   imports API implementation source.
5. Session credentials remain in secure server-managed cookies; browser storage
   contains no authentication or CSRF credentials.
6. The API is the sole authority for authentication, authorization, validation,
   commerce decisions, and persistent state.
7. UI permissions use exact server-returned permission identifiers, never role
   names, and deny unknown permissions.
8. Every protected mutation follows the API's CSRF and trusted-origin contract.
9. Exact Money is never converted to floating point for an authoritative
   calculation.
10. High-impact operational mutations are confirmed by server success before
    the UI presents them as complete.
11. Logout or authentication loss removes protected cached state.
12. Merchant storefront themes and copied presentation source never become
    Admin dependencies.

## Consequences

### Positive

- All store deployments receive the same maintainable operational application.
- The SDK keeps Admin aligned with the API contract without sharing backend
  internals.
- Same-origin deployment preserves the established cookie and CSRF model with
  minimal browser complexity.
- Feature ownership allows incremental work without a generic global state
  architecture.
- Permission-driven UI improves operator clarity while preserving server-side
  authority.
- Conservative mutation behavior reduces accidental stock, price, Order,
  payment, and staff inconsistencies.

### Costs

- Each store deployment must release a compatible Admin artifact with the API.
- A static SPA requires explicit loading, error, and session-expiry states.
- Permission-aware navigation and route boundaries add frontend work even
  though the API already enforces authorization.
- Same-origin local development requires a correctly configured proxy.
- Avoiding optimistic updates makes some operational mutations feel less
  immediate, in exchange for reliable server-confirmed state.

## Alternatives considered

### Server-side rendering or React Server Components for Admin

Rejected for version 1. Admin is an authenticated operational application with
no SEO requirement. React and Vite provide a smaller deployment and mental
model. Admin is fully client-rendered. This does not constrain merchant
storefronts, which have different server-rendering and streaming requirements
owned by ADR-0011.

### Serve Admin as NestJS templates

Rejected. It couples presentation compilation to the API runtime, weakens the
external contract boundary, and makes independent frontend verification harder.
The static artifact may be delivered by the same deployment without becoming
API source.

### A central multi-store Admin service

Rejected. It would introduce tenant isolation, cross-store identity, a control
plane, and a much larger operational blast radius before the product needs
them. Each store remains an independent deployment.

### Handwritten fetch calls and duplicate TypeScript DTOs

Rejected. They drift from OpenAPI and create multiple transport behaviors. The
generated SDK and one adapter are the supported boundary.

### Global state store from the beginning

Rejected. Server cache, URL state, and local React state cover the current
needs more directly. A global store requires a demonstrated cross-feature
problem.

### Metadata-driven generic CRUD Admin

Rejected. Catalog, Inventory, Orders, Shipping, Payments, and Staff have
different invariants and operational workflows. A generic schema-driven UI
would hide those differences without removing backend complexity.

### Merchant-specific Admin themes or forks

Rejected. They recreate the maintenance problem that the shared platform is
designed to avoid. Public branding configuration is sufficient for the
operational application.

### Offline-first or realtime Admin

Rejected for version 1. Offline writes create conflict and audit complexity;
realtime infrastructure has no measured requirement at the expected scale.
Explicit refresh and bounded query invalidation are sufficient initially.

## Explicit non-goals

This decision does not introduce:

- a storefront CMS, page builder, or visual theme editor;
- a multi-store or multi-tenant control plane;
- merchant-specific Admin source repositories or forks;
- microfrontends, runtime plugins, or dynamic module loading;
- custom role-definition editing;
- online payment-gateway configuration;
- carrier integrations or fulfillment execution;
- offline operation or background mutation queues;
- WebSocket or event-stream infrastructure;
- authoritative commerce calculations in the browser;
- a general UI package for external storefronts.

## Related decisions and contracts

- ADR-0001 — Platform Architecture Principles
- ADR-0002 — Repository and Workspace Boundaries
- ADR-0003 — Backend Module Architecture
- ADR-0004 — Commerce Domain Model
- ADR-0006 — Orders and Historical Purchase State
- ADR-0007 — Exact Money and Pricing
- ADR-0008 — Inventory and Reservations
- ADR-0013 — Shipping Methods, Zones, and Rate Rules
- ADR-0014 — Manual Payments and Admin Order Acceptance
- Authorization contract
- External HTTP API and SDK contract

## Acceptance and freeze policy

The platform owner accepted and froze this ADR on 2026-07-26. Acceptance freezes
the application boundary, authority rules, same-origin session model, SDK
dependency, permission model, selected initial stack, and state categories.

Individual libraries, directory details, visual components, and feature
delivery order may evolve without superseding this ADR when the invariants
remain true. A move to a central multi-store Admin, a different authentication
credential model, merchant-specific Admin forks, or browser-owned commerce
authority requires an explicit amendment or superseding ADR.
