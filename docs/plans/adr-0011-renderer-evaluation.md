# ADR-0011 reference renderer evaluation

Status: completed evaluation; ADR-0011 accepted
Evaluated: 2026-07-27

## Purpose

ADR-0011 requires a bounded renderer evaluation before storefront
implementation. This document evaluates the renderer for the platform-owned
`apps/reference-storefront`. It does not make the renderer part of
`@better-commerce/sdk`, `@better-commerce/storefront-core`, or the external
storefront contract.

## Required capabilities

The selected renderer must provide:

- server-rendered Product and content routes;
- build-time prerendering for explicitly public routes;
- meaningful HTML streaming through React Suspense;
- selective browser hydration for cart, authentication, and checkout;
- request-scoped headers, cookies, cancellation, and API clients;
- enforceable server-only module boundaries;
- explicit cache headers and safe handling of personalized responses;
- a straightforward Node.js and Docker deployment;
- TypeScript support without platform-specific imports in public packages.

React Server Components are optional for merchant storefronts. The Next.js
reference storefront uses them deliberately. SSR and streaming remain the
portable capability requirements.

## Options

### React Router Framework Mode

React Router Framework Mode provides stable SSR, static prerendering, typed
route modules, loaders, actions, code splitting, error boundaries, and
Suspense-based streaming. Its `.server` module convention makes the build fail
when server-only code enters the browser graph.

It supports the required behavior without adopting experimental React Server
Components. It remains a valid merchant-storefront choice when RSC is not a
requirement.

Official references:

- <https://reactrouter.com/start/modes>
- <https://reactrouter.com/start/framework/rendering>
- <https://reactrouter.com/how-to/suspense>
- <https://reactrouter.com/api/framework-conventions/server-modules>

### Next.js App Router

Next.js provides mature Server Components, Client Components, prerendering,
streaming, self-hosting, and Docker-compatible Node deployment. It is capable
of meeting ADR-0011.

Its additional cache model, file conventions, RSC transport, and
framework-specific server features require deliberate isolation. The platform
owner has made React Server Components a concrete goal for the reference
storefront, so those costs are justified within that application.

Official references:

- <https://nextjs.org/docs/app>
- <https://nextjs.org/docs/app/getting-started/server-and-client-components>
- <https://nextjs.org/docs/app/guides/self-hosting>

### TanStack Start

TanStack Start closely matches the desired type-safe, Vite-based architecture.
It provides full-document SSR, streaming, server functions, server routes, and
portable server output. It would also align with the TanStack tools already
used in Admin.

The official documentation currently labels TanStack Start as a release
candidate. Its React Server Components support is experimental. Adopting it now
would trade framework maturity for ecosystem consistency, which is not the
right trade for a long-lived production template maintained by one developer.
It should be reconsidered after a stable major release and an external-consumer
deployment record exist.

Official references:

- <https://tanstack.com/start/latest/docs/framework/react/overview>
- <https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point>
- <https://tanstack.com/start/latest/docs/framework/react/guide/hosting>

### Custom React SSR

React supplies the streaming primitives needed to build a renderer directly,
but a custom stack would also need routing, data loading, serialization,
hydration, error boundaries, prerendering, asset manifests, and deployment
integration. That is unnecessary platform infrastructure and would increase
solo-maintainer risk without improving the commerce boundary.

## Recommendation

Select **Next.js App Router** for `apps/reference-storefront`.

The choice is intentionally local to the reference application:

- public SDK and storefront-core packages must not import Next.js;
- merchant storefronts may use another renderer if they satisfy ADR-0011;
- API access remains through documented HTTP and SDK contracts;
- server-side clients are created per incoming request;
- browser mutations continue to use same-origin sessions, CSRF, and
  idempotency;
- caching is opt-in for public data and forbidden for personalized output;
- commerce rules remain exclusively in the API.

The reference storefront uses Server Components for public Product composition
and small Client Components for interaction. This does not turn the RSC
transport, Next.js cache directives, cookie APIs, or route conventions into
platform package contracts.

## Re-evaluation triggers

Re-evaluate the renderer only when:

- the reference storefront no longer benefits from React Server Components;
- Next.js can no longer satisfy required streaming, self-hosting, or deployment
  behavior;
- TanStack Start reaches a stable major release and offers a materially simpler
  verified deployment;
- two merchant storefronts demonstrate a repeated framework-level limitation.

Normal framework releases, developer preference, or a new tutorial are not
re-evaluation triggers.

## Acceptance gate and next implementation slice

ADR-0011 is accepted with Next.js App Router as the selected reference renderer
while preserving the framework-neutral public contract.

After acceptance, the next implementation slice is ADR-0011 step 2:

1. audit the current SDK for browser globals, Node-only imports, singleton
   request state, and framework assumptions;
2. define explicit supported server and browser entry-point behavior;
3. verify both environments without adding React Router imports to the SDK;
4. prove the package through a clean external-consumer fixture;
5. only then scaffold the reference storefront around the proven SDK boundary.
