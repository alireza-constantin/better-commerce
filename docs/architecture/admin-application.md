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

    lib/
      utils.ts                  Class-name composition for UI source

    styles/
      globals.css               Tailwind and application design tokens
```

The application is a fully client-rendered React and Vite SPA mounted at
`/admin/`. Persian is the default application language and the document and
authenticated shell are RTL-first. Technical identifiers such as email
addresses and request IDs retain explicit LTR direction.

Phases 2 and 3 implement SDK-backed authentication bootstrap, login, logout,
in-memory CSRF management, problem normalization, distinct unauthenticated,
forbidden, and unavailable states, the responsive authenticated shell, exact
permission helpers, permission-filtered navigation, and protected operational
routes.

Operational feature pages are deliberately delivery placeholders until their
own phases connect real API data. They do not invent dashboard metrics or imply
that an unfinished workflow is available.

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

## Verification

The Admin participates in root Turborepo `build`, `typecheck`, and `lint` tasks.
Its production output is the ignored `apps/admin/dist` directory.
