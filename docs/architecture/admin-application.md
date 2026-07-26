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
      router.tsx                TanStack Router composition
      query-client.ts           TanStack Query policy

    components/ui/
      button.tsx                First source-owned UI primitive

    features/foundation/
      foundation-page.tsx       Temporary Phase 1 verification route
      not-found-page.tsx        Route-level missing-page state

    lib/
      utils.ts                  Class-name composition for UI source

    styles/
      globals.css               Tailwind and application design tokens
```

The application is a fully client-rendered React and Vite SPA mounted at
`/admin/`. It currently contains only the technical foundation. Authentication,
the SDK-backed API adapter, CSRF lifecycle, protected shell, permissions, and
commerce features are not implemented yet.

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

TanStack Query is installed and configured but does not fetch API data yet.
TanStack Router owns client routing. Zustand is intentionally not installed
because Phase 1 has no proven client-only global state requirement.

## Verification

The Admin participates in root Turborepo `build`, `typecheck`, and `lint` tasks.
Its production output is the ignored `apps/admin/dist` directory.
