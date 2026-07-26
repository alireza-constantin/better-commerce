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
      admin-root.tsx             Authenticated application boundary
      router.tsx                TanStack Router composition
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
      access-denied-page.tsx     Authenticated non-staff state
      session-loading-page.tsx   Initial bootstrap state
      session-unavailable-page.tsx Recoverable service failure

    features/foundation/
      foundation-page.tsx       Temporary authenticated route
      not-found-page.tsx        Route-level missing-page state

    lib/
      utils.ts                  Class-name composition for UI source

    styles/
      globals.css               Tailwind and application design tokens
```

The application is a fully client-rendered React and Vite SPA mounted at
`/admin/`. Phase 2 implements SDK-backed authentication bootstrap, login,
logout, in-memory CSRF management, problem normalization, and distinct
unauthenticated, forbidden, and unavailable states.

The protected operational shell, permission-driven navigation, and commerce
features are not implemented yet.

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
  │     └── features/foundation
  ├── app/query-client.ts
  └── styles/globals.css

features/foundation
  └── components/ui
```

TanStack Query owns the server-authoritative Admin profile and mutation states.
TanStack Router owns client routing. Zustand remains intentionally absent
because there is no proven client-only global state requirement.

The API adapter consumes `@better-commerce/sdk`, captures safe problem details
and request IDs, and publishes authentication loss without persisting session
data. CSRF tokens exist only inside the in-memory token manager.

## Verification

The Admin participates in root Turborepo `build`, `typecheck`, and `lint` tasks.
Its production output is the ignored `apps/admin/dist` directory.
