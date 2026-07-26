# Admin Application Map

Status: Living document  
Last verified: 2026-07-26

## Purpose

This document describes the currently implemented Admin application structure
and development boundary. ADR-0010 explains the accepted architecture. Update
this map when the implemented application topology changes.

## Current source map

```text
apps/admin/
  index.html                    Client application document
  vite.config.ts               Build, /admin base path, /api dev proxy
  components.json              shadcn/ui source ownership configuration
  eslint.config.js             Typed React lint boundary

  src/
    main.tsx                    Browser composition root

    app/
      admin-root.tsx             Session-backed shell composition
      navigation/               Permission-declared Persian navigation
      routes/                   Shared route contract and lazy boundaries
      shell/                    Responsive authenticated RTL frame
      router.tsx                Protected TanStack Router composition
      query-client.ts           TanStack Query policy

    api/
      client/                    SDK client, response handling, session loss
      csrf/                      In-memory CSRF lifecycle
      problems/                  Safe RFC 9457 normalization

    components/ui/
      button.tsx                First source-owned UI primitive

    features/auth/
      api/                       Admin profile, login, logout, query contract
      admin-bootstrap.tsx        Session state boundary
      login-page.tsx             Password login
      logout-button.tsx          Session logout action
      permissions/               Exact permission helpers and route boundary
      session/                   Authenticated profile context
      access-denied-page.tsx     Authenticated non-staff state
      session-loading-page.tsx   Initial bootstrap state
      session-unavailable-page.tsx Recoverable service failure

    features/foundation/
      overview-page.tsx          Authenticated workspace overview
      phase-three-routes.tsx     Permission-bound operational route screens
      feature-placeholder-page.tsx Honest feature delivery boundary
      not-found-page.tsx        Route-level missing-page state

    features/orders/
      api/                       SDK-backed list, detail, and decisions
      components/                Persian operational list and detail UI
      orders-routes.tsx          Query, cursor, permission, and mutation wiring

    features/catalog/
      api/                       Product lifecycle and configuration contract
      catalog-routes.tsx         Filtered list, create, detail, and editing

    features/pricing/
      api/                       Exact current-price and version creation contract
      pricing-routes.tsx         Variant price lookup and immutable version form

    features/inventory/
      api/                       Inventory configuration and adjustment contract
      inventory-routes.tsx       Variant command workflow and result state

    features/shipping/
      api/                       Zone, method, and rate-rule contract
      shipping-routes.tsx        Hierarchical configuration management

    features/staff/
      api/                       Staff lifecycle and built-in role contract
      staff-routes.tsx           Staff, role, and status operations

    features/authorization-audit/
      api/                       Safe filtered authorization-event contract
      authorization-audit-routes.tsx Cursor list and event inspection

    features/commerce-audit/
      api/                       Safe commerce-event contract
      components/                Event list and structured detail presentation
      commerce-audit-route.tsx   Cursor history and query composition

    lib/
      utils.ts                  Class-name composition for UI source

    styles/
      globals.css               Tailwind and application design tokens
```

The application is a fully client-rendered React and Vite SPA mounted at
`/admin/`. Persian is the default application language and the document and
authenticated shell are RTL-first. Technical identifiers such as email
addresses and request IDs retain explicit LTR direction.

Phases 2 through 6 implement SDK-backed authentication bootstrap, login, logout,
in-memory CSRF management, problem normalization, distinct unauthenticated,
forbidden, and unavailable states, the responsive authenticated shell, exact
permission helpers, permission-filtered navigation, and protected operational
routes. Orders is the first complete operational feature: cursor list and
detail views, immutable purchase snapshots, manual-payment confirmation,
acceptance, and rejection.

Catalog, Pricing, Inventory, and Shipping are also operational. Catalog owns
validated URL filters and cursor history. Pricing preserves exact decimal
strings and creates immutable price versions. Inventory exposes only the
configuration and adjustment commands supported by its API. Shipping manages
the accepted Zone, Method, and non-overlapping rate-rule hierarchy. Staff and
audit screens remain delivery placeholders until Phase 6.

## Runtime boundary

During local development:

```text
browser -> http://localhost:5173/admin/
browser -> http://localhost:5173/api/* -> Vite proxy -> API :3000
```

The browser does not use credentialed CORS. The example API configuration trusts
both local development origins. Production retains ADR-0010's same-origin
reverse-proxy requirement.

## Implemented dependency direction

```text
main.tsx
  ├── app/router.tsx
  │     ├── app/admin-root.tsx
  │     │     ├── app/navigation
  │     │     ├── app/shell
  │     │     └── features/auth
  │     └── features/foundation
  ├── app/query-client.ts
  └── styles/globals.css

features/foundation
  ├── features/auth/permissions
  └── components/ui
```

TanStack Query owns the server-authoritative Admin profile and mutation states.
TanStack Router owns client routing. Zustand remains intentionally absent
because there is no proven client-only global state requirement.

The API adapter consumes `@better-commerce/sdk`, captures safe problem details
and request IDs, and publishes authentication loss without persisting session
data. CSRF tokens exist only inside the in-memory token manager.

The client uses only the server-returned effective permission keys for
navigation and route affordances. It never treats a role name as authority.
Unknown or missing permissions deny access. These client checks improve the
experience but do not replace the API's default-deny authorization.

Route paths and permission requirements have one typed contract consumed by
the router, navigation, and route access boundaries. Operational route screens
are loaded outside the initial application chunk. Navigation transitions move
keyboard focus into the main content, while Escape closes the mobile menu and
restores focus to its toggle.

Orders keep cursor state in validated URL search parameters. Mutations use the
shared CSRF-aware adapter, never update authoritative state optimistically, and
invalidate only Order list/detail query families after confirmed server
success. Exact monetary strings are displayed without floating-point
conversion.

The same server-authoritative mutation policy applies to Catalog, Pricing,
Inventory, and Shipping. Pricing and Shipping preserve exact decimal strings.
Inventory uses an explicit Variant ID command workflow because the accepted API
does not expose a general inventory collection or single-item read endpoint;
the Admin does not invent an unavailable browser or cached authority.

Staff operations use only the actor's exact effective permissions. Owner
assignment and owner-profile status affordances require `staff.assign_owner`;
role names remain display data rather than browser authorization authority.
Changes affecting the current actor invalidate the Admin session profile.

Authorization and commerce audit screens are read-only, bounded, cursor-backed
views. Filter and cursor navigation belongs to validated URL search state.
Metadata is rendered only as escaped structured text, and technical identifiers
retain explicit LTR direction.

## Verification

The Admin participates in root Turborepo `build`, `typecheck`, and `lint` tasks.
Its production output is the ignored `apps/admin/dist` directory.
