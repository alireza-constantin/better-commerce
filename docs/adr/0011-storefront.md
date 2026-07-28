# ADR-0011 — Storefront Rendering and Integration Architecture

Status: Accepted
Date: 2026-07-26
Revised: 2026-07-27
Accepted: 2026-07-27
Frozen: 2026-07-27

## Context

Better Commerce serves merchants whose customer-facing sites may differ
substantially in layout, content, routes, components, and visual identity. A
dog-house store, clothing store, bicycle shop, and cosmetics shop should not be
forced into one database-driven theme or one generic page model.

ADR-0001 therefore assigns presentation and developer-maintained content to
storefronts while keeping commerce rules in the platform. ADR-0002 places the
reference storefront in the platform monorepo, places each production merchant
storefront in an independent repository, and divides reusable storefront work
between versioned runtime packages and locally owned presentation source.

The remaining decision is how storefronts render and how reusable commerce
integration works across server and browser environments. Product and category
pages benefit from server rendering, static generation, search visibility,
fast first content, and HTML streaming. Cart, authentication, checkout, and
account workflows require browser interaction and secure session behavior.

The platform must preserve both capabilities without making its public SDK
depend on Next.js or any other rendering framework. It must also avoid the
opposite mistake of copying session, CSRF, cart, and checkout protocol code into
every merchant repository.

This ADR defines the durable rendering capabilities, package boundaries,
request and cache rules, storefront ownership model, and the renderer used by
the platform-owned reference storefront. It does not select the
presentation-source installation mechanism; ADR-0012 owns that later decision.

## Decision drivers

- Permit server-rendered and statically rendered commerce pages.
- Permit streamed HTML and progressive rendering of independent page regions.
- Allow each merchant storefront to select a suitable meta-framework without
  changing commerce contracts.
- Avoid coupling the public SDK or correctness-sensitive integration core to
  Next.js, Astro, TanStack Start, or another storefront framework.
- Permit reusable React presentation without pretending compiled React Server
  Components are a framework-neutral artifact.
- Keep authentication, CSRF, cart, and checkout integration centrally
  maintainable.
- Give each merchant full ownership of presentation source and static content.
- Prevent personalized data from entering shared server caches.
- Keep one API authoritative for prices, stock, shipping, checkout, and Orders.
- Support independently built and deployed merchant storefront repositories.
- Remain understandable and operable by a solo developer at the expected scale.
- Avoid API-level streaming, a CMS, or a frontend control plane without a real
  requirement.

## Decision

### Rendering-capable, framework-neutral storefront contract

A Better Commerce storefront is a customer-facing presentation application that
consumes documented HTTP and package contracts. It may use any rendering
framework that satisfies the storefront runtime contract in this ADR.

The platform does not mandate Next.js or React for every merchant storefront.
In particular, `@better-commerce/sdk` and
`@better-commerce/storefront-core` do not import Next.js, Astro, TanStack
Start, React Router, or React modules; expose framework request objects; use
framework cache directives; or require framework file conventions.

The standard storefront runtime must support:

- server rendering of route content;
- static prerendering where content and freshness rules permit it;
- streamed HTML with explicit loading and error boundaries;
- selective browser hydration or client components for interaction;
- server-only modules that cannot enter browser bundles;
- request-scoped access to headers and cookies;
- aborting downstream requests when the incoming request is cancelled;
- explicit public-data caching and revalidation;
- dynamic, non-shared handling of personalized requests;
- Docker-compatible production deployment for one store installation.

React Server Components may be used by a selected renderer when its toolchain
supports them. They are not themselves the platform contract: React Server
Components require a compatible bundler, router, serialization protocol, and
server runtime. Portable public runtime packages therefore expose server-safe
data and integration functions, not precompiled framework-specific server
components.

### Reference renderer selection and scope

ADR-0002 selected Next.js for `apps/reference-storefront`. The bounded
evaluation required by this ADR confirms **Next.js App Router** for the initial
reference implementation.

`apps/reference-storefront` remains the official platform-owned reference
consumer and retains every repository, dependency, source-ownership, and
verification responsibility assigned by ADR-0002. It uses Next.js Server
Components for public, server-owned composition and small Client Components for
interaction. This choice demonstrates RSC, streaming, static rendering, and
request-scoped integration in one executable reference.

Next.js is an application dependency of the reference storefront, not a
platform requirement. A merchant storefront may instead use Astro, TanStack
Start, React Router, or another renderer that satisfies this ADR. Selecting or
changing a merchant's framework must not require an API redesign, fork
correctness-sensitive integration, or move commerce rules into merchant source.

### SSR, React rendering, and React Server Components

This ADR distinguishes three capabilities:

1. **Server rendering** produces HTML on a server or at build time. It is a
   storefront capability and is not specific to React.
2. **React server rendering** renders ordinary React presentation to HTML. It
   may be consumed by any renderer with a compatible React integration.
3. **React Server Components** use a renderer-specific compilation,
   serialization, routing, and client-reconciliation pipeline.

The platform may distribute framework-neutral React presentation source and
framework-specific integration recipes. The merchant repository compiles that
source with its selected renderer. It does not consume one supposedly
universal precompiled RSC artifact.

For example, Next.js may compile locally owned presentation as Server and
Client Components. Astro may server-render the same compatible React
presentation and hydrate selected islands while owning page composition in
Astro source. TanStack Start may adopt the same core and presentation after its
required features meet the deployment's maturity standard.

### Hybrid server and browser composition

Storefront pages use server rendering for public, content-heavy, or
search-visible regions and browser execution for interactive customer
workflows.

Typical server-rendered regions include:

- Product and Variant detail;
- category and collection pages;
- product lists and search results;
- public prices and availability projections;
- public shipping information;
- navigation, metadata, and structured search data;
- developer-maintained merchant pages and content-as-code.

Typical browser-interactive regions include:

- Product option and quantity interaction;
- cart controls and cart drawer;
- login, registration, and logout;
- customer addresses and account interaction;
- shipping selection during checkout;
- checkout submission;
- customer Order interaction.

This is not a rigid rule that every personalized read must wait for hydration.
A capable renderer may server-render authenticated data by forwarding the
request's session cookie and disabling shared caching. The initial reference
implementation should prefer browser interaction for session-heavy workflows
until a server-rendered version provides a measured user benefit.

### HTML streaming, not API record streaming

The storefront runtime may begin sending the page shell while independent
server-rendered regions are still resolving. Product sections can live behind
separate Suspense-style boundaries so, for example, navigation and merchant
content render before a product grid.

```text
page shell
  ├── merchant content
  ├── featured-products boundary
  └── newest-products boundary
```

Each product-list region initially loads one bounded, cursor-paginated JSON
response from the API. The renderer streams completed HTML regions; the API
does not stream individual Product records.

NDJSON, Server-Sent Events, WebSockets, or a streaming Product endpoint are not
introduced by this decision. API-level streaming has different compatibility,
failure, caching, and observability requirements and needs a separate contract
if measurements later justify it.

Streaming boundaries are chosen around meaningful page regions, not every
Product card. Excessively granular boundaries increase layout movement,
requests, hydration work, and error complexity without necessarily improving
perceived speed.

### Four layers with separate ownership

The storefront integration has four layers:

```text
merchant storefront source
  ├── routes, content, layout, and framework configuration
  ├── locally owned presentation source
  │     ├── portable React presentation where applicable
  │     └── framework-specific route, RSC, island, and hydration adapters
  ├── @better-commerce/storefront-core
  │     ├── server entry point
  │     └── browser entry point
  └── @better-commerce/sdk
        └── generated HTTP contract
```

The SDK is the low-level transport contract. `storefront-core` supplies
correctness-sensitive integration mechanisms. Reusable presentation is visible
source owned by the merchant repository. The merchant repository owns its
renderer, routes, layout, presentation, and content.

None of these layers becomes a second commerce domain. The API remains
authoritative.

### Framework and UI-runtime portability

Portability is promised at explicit layers rather than as one universal UI
artifact:

- any client capable of HTTP can consume the external API;
- JavaScript and TypeScript storefronts can consume the SDK and
  `storefront-core`;
- React-compatible renderers can consume reusable React presentation source;
- non-React renderers reuse the API and integration behavior but provide their
  own presentation;
- framework-specific route files, metadata, caching, cookies, actions,
  hydration, image components, and RSC boundaries remain local source.

The platform does not build a meta-framework normalization layer. It does not
wrap Next.js cache directives, Astro prerender flags, TanStack loaders, or
renderer cookie APIs behind a single imitation API. Shared packages stop at
portable HTTP, request, session, and commerce-integration behavior.

### Universal SDK boundary

`@better-commerce/sdk` remains a small, rendering-framework-neutral package. It
contains:

- OpenAPI-generated paths, operations, and schemas;
- the generated-backed typed HTTP client;
- client construction with configurable base URL, headers, credentials, and
  `fetch`;
- request cancellation through standard `AbortSignal`;
- the exact external problem-detail and response contract.

The SDK contains no React components, rendering behavior, page cache,
authentication store, CSRF lifecycle, cart synchronization, checkout
orchestration, pricing rules, or inventory rules.

The SDK must be safe to import in modern server and browser environments. A
universal entry point does not access `window`, `document`, browser storage,
Node globals, cookies, or mutable request state at module initialization.
Environment-specific behavior is supplied through options or explicit package
entry points.

Server callers explicitly forward allowed request context. The SDK never reads
a global cookie jar or retains one customer's headers in a singleton.

### `storefront-core` public entry points

`@better-commerce/storefront-core` is created only when the reference
storefront proves the first real shared integration behavior. It has explicit,
condition-safe exports:

```text
@better-commerce/storefront-core
@better-commerce/storefront-core/server
@better-commerce/storefront-core/browser
```

The root entry point contains only environment-neutral types and mechanisms
that are safe in both environments. Consumers do not deep-import package
source.

The server entry point may own:

- request-scoped SDK client construction;
- public Catalog query functions;
- explicit forwarding of permitted cookie and request headers;
- normalization of server-side API failures;
- public versus personalized cache metadata;
- cursor-page loading helpers;
- request cancellation propagation;
- safe public store configuration access.

The browser entry point may own:

- CSRF token acquisition, refresh, and mutation attachment;
- browser session lifecycle integration;
- cart read and mutation coordination;
- checkout idempotency-key lifecycle;
- checkout submission orchestration;
- normalized browser-facing API errors;
- safe reconciliation after an uncertain mutation outcome.

The package does not own:

- Product grids, cards, page layouts, forms, or styling;
- merchant content, navigation, routes, or metadata;
- authoritative price, availability, shipping, payment, or Order rules;
- a framework router or framework cache;
- a global React state library;
- secrets or merchant-specific source.

The server entry point must not import the browser entry point. Browser bundles
must not contain server-only configuration, cookie-forwarding helpers, or
secrets. Conditional export and bundle checks enforce this separation.

### Presentation source remains local

Every production merchant storefront repository owns:

- routes and page composition;
- server-rendered and client-interactive components;
- layouts, styling, fonts, and visual assets;
- static copy and content-as-code;
- SEO metadata and structured presentation data;
- accessibility and responsive behavior;
- storefront-specific tests and deployment configuration.

Reusable Product lists, Product cards, cart drawers, checkout forms, and page
sections may be installed as visible presentation source and modified locally.
They are not hidden in a runtime UI dependency. The catalogue, transport,
provenance, installation, and update behavior for that source belongs to
ADR-0012.

Reusable presentation may include portable React source plus optional
framework-specific recipes such as a Next.js RSC route, an Astro page or
island, or a TanStack Start route. A recipe owns only framework composition and
presentation. Authentication, CSRF, cart, checkout, idempotency, and API error
protocols remain calls into versioned runtime packages.

Copied presentation source may call documented `storefront-core` or SDK entry
points. It must not copy or reimplement session protocols, CSRF rotation,
checkout idempotency, authoritative calculations, or API private behavior.

### Same-origin production request model

A production storefront and its store API use one public origin:

```text
https://shop.example.com/*        -> storefront renderer
https://shop.example.com/api/v1/* -> Better Commerce API
```

The storefront and API may run in different containers and come from different
repositories. A reverse proxy presents one origin and routes the paths.

Browser integrations use relative API URLs, secure same-origin cookies,
credentialed requests, trusted-origin enforcement, and the documented CSRF
contract. Storefront source does not add credentialed CORS as its default
production architecture.

The renderer's server process may call the API through an internal service URL
for public reads when deployment configuration requires it. Browser-visible
URLs and cookies still follow the same-origin contract. Internal routing must
not cause public cache keys, redirects, canonical URLs, or generated links to
expose container addresses.

### Server request isolation

All authenticated server-side API access is request-scoped. The renderer may
forward only the session cookie and other explicitly allowed headers required
by the public contract. It does not forward arbitrary inbound headers.

The following must never be held in a process-global client or cache:

- session cookies;
- CSRF tokens;
- customer identity;
- cart or account data;
- addresses;
- customer Orders;
- request IDs;
- authorization-derived responses.

Server rendering escapes serialized data through the renderer's supported
mechanism. Storefront code does not interpolate untrusted JSON into raw HTML.

### Cache and freshness model

Caching is explicit by data category.

#### Public commerce data

Public Catalog and presentation-independent commerce reads may use bounded
server or edge caching when their API contract and invalidation tolerance allow
it. Cache keys include every input that can change the response, such as store
deployment, route parameters, cursor, locale, currency, and applicable public
configuration.

Cached prices and availability are display projections, never checkout
authority. Checkout revalidates exact price, Inventory, Shipping, and purchase
eligibility through the API.

#### Merchant content

Developer-maintained content-as-code is built or prerendered with the
storefront. A text or layout change produces a commit and deployment in that
merchant repository. It is not loaded from the commerce database on every
request.

#### Personalized data

Any request whose result depends on a session, customer, cart, address,
customer Order, or other private input is dynamic and `private` or `no-store`
at every shared cache boundary. It must not use public static regeneration or a
cross-request application cache.

Framework defaults are not accepted as proof of safe caching. The reference
storefront must verify public and personalized behavior through tests.

### Mutations and server actions

Version 1 sends customer mutations from browser integration through the
same-origin API. This includes login, registration, logout, cart changes,
address changes, and checkout submission.

A storefront framework's server actions, form actions, route handlers, or
backend-for-frontend layer are not part of the initial platform contract.
Proxying a mutation through the storefront server changes cookie forwarding,
CSRF, origin, idempotency, failure, logging, and rate-limit semantics. A
renderer may not invent such a proxy around a protected API route.

Server-executed mutations require a focused reviewed integration contract
before they become supported platform behavior. This restriction does not
prevent server-rendered forms or pages; their protected submission uses the
browser entry point.

### Cart and checkout responsibility

Cart presentation is locally owned source. Cart persistence and authoritative
validation remain API behavior. `storefront-core/browser` coordinates the
documented cart protocol so it does not need to be copied across storefronts.

Checkout presentation is also locally owned source. Checkout orchestration that
must remain correct across storefronts belongs to the versioned browser entry
point, including:

- acquiring and retaining one idempotency key for one logical submission;
- attaching CSRF state;
- preventing accidental duplicate submission;
- distinguishing validation, conflict, and unknown outcomes;
- fetching the authoritative resulting Order after safe recovery;
- discarding or rotating submission state at the correct lifecycle boundary.

The storefront may format quoted Money and explain selections. It does not
calculate the accepted total, reserve Inventory, select an authoritative
Shipping rate, accept payment, or create an Order locally.

### Exact values and serialization

Money remains the API contract's decimal string plus currency from server fetch
through rendered output and browser hydration. Storefront code never converts
Money to JavaScript floating point for authoritative totals.

UTC instants remain unambiguous through server and browser serialization.
Locale formatting occurs at presentation boundaries and does not alter the
underlying contract value.

Cursor pagination remains cursor pagination. Server-rendered Product lists do
not fabricate exact total counts or arbitrary page numbers when the API does
not provide them. Load-more, next/previous, or bounded section rendering are
valid presentations of the cursor contract.

### Failure and streaming behavior

Each independently streamed region has:

- a stable loading fallback sized to limit layout movement;
- a contained error boundary;
- cancellation when the request or navigation ends;
- a retry path appropriate to whether the data is public or personalized.

A secondary Product section failure does not have to fail the entire document.
A failure of route-critical Product data may produce the renderer's documented
not-found or service-error response.

Once response bytes are streamed, the renderer may no longer be able to change
the HTTP status. Critical route existence and redirect decisions therefore
resolve before committing the response where the selected runtime allows it.
The reference implementation documents this tradeoff rather than assuming
streaming removes HTTP semantics.

### Reference storefront responsibility

`apps/reference-storefront` is a non-production reference and executable
contract test. It must demonstrate:

- one Next.js App Router Product-list route composed with Server Components;
- one Next.js App Router Product-detail route composed with Server Components;
- at least two independently streamed page regions;
- static merchant content owned as source;
- one browser-interactive cart flow;
- login and logout using the shared session contract;
- checkout through `storefront-core/browser`;
- public caching and personalized no-store behavior;
- exact Money across server render and hydration;
- no private API-source imports;
- the same package and copied-source boundary offered to external storefronts.

It is not a universal runtime-configured theme and does not become the base
repository copied wholesale for every merchant. It proves integration behavior
and supplies examples.

### Renderer independence and evaluation

The completed bounded evaluation selected Next.js App Router for the initial
reference storefront because it provides mature Server Components, streaming,
static rendering, TypeScript support, and self-hosted Node and Docker
deployment.

That evaluation does not rank Next.js as universally correct. A content-heavy
merchant may select Astro for static generation, on-demand rendering, HTML
streaming, and selective React islands. A later merchant may select TanStack
Start after its needed features meet the project's stability bar.

Every selected framework remains responsible for the same request isolation,
cache safety, exact serialization, deployment, and browser mutation contract.
The platform claims a framework integration as proven only after a clean
consumer builds and verifies the relevant boundary.

### Compatibility and releases

Each production merchant storefront pins compatible versions of:

- `@better-commerce/sdk`;
- `@better-commerce/storefront-core` when it exists;
- public store configuration schemas when consumed;
- its selected rendering framework.

Platform package releases declare their supported API compatibility. A
storefront upgrade is tested and deployed from that storefront repository.
Platform releases never silently overwrite local presentation source.

The reference storefront continuously verifies the newest supported contract.
Once the first external production storefront exists, breaking SDK or
`storefront-core` changes require explicit compatibility, deprecation, and
migration policy.

### Security boundary

Storefront server and browser source follows these rules:

- no platform or deployment secrets enter client bundles;
- secure session cookies remain opaque and unreadable to JavaScript;
- CSRF state is held in memory rather than persistent browser storage;
- public runtime configuration contains no secrets;
- raw HTML from untrusted content is not rendered without an explicit,
  reviewed sanitization boundary;
- customer-specific API results are not written into logs, public caches, or
  static output;
- protected mutation failures do not expose internal errors;
- Content Security Policy and asset-origin requirements are part of production
  deployment;
- third-party scripts are minimized and reviewed because they execute in the
  customer session origin.

No theme or copied presentation component can weaken API authorization,
trusted-origin enforcement, CSRF, idempotency, or checkout validation.

### Performance and accessibility

Server rendering and streaming are tools, not goals by themselves. The
storefront measures:

- time to first byte;
- largest contentful paint;
- cumulative layout shift;
- interaction responsiveness;
- server rendering duration;
- API request count and latency;
- client JavaScript size.

The initial design favors bounded Product queries, meaningful streaming
regions, limited hydration, optimized media, and static merchant content.
Prefetching and edge caching are added only with explicit freshness and resource
budgets.

Copied and locally authored presentation remains responsible for semantic
markup, keyboard behavior, visible focus, responsive layout, accessible names,
and sufficient contrast. The target is WCAG 2.2 AA for customer purchase
workflows.

### Verification boundary

The platform verifies:

1. SDK imports and behavior in both server and browser test environments.
2. Conditional exports prevent browser/server boundary violations.
3. Public Product pages render without browser JavaScript.
4. Streaming sends the shell and independent regions progressively.
5. Personalized data is not present in static output or shared caches.
6. Session cookies are request-scoped during authenticated server rendering.
7. Browser mutations attach CSRF state and checkout idempotency correctly.
8. Exact Money survives server render, serialization, hydration, and
   submission.
9. The reference storefront uses only documented external contracts.
10. A clean external-consumer fixture can install and build against published
    package entry points without platform source aliases.
11. A minimal non-Next consumer proves the SDK and `storefront-core` do not
    require Next.js or its request, cache, cookie, or routing APIs.

Each merchant repository additionally verifies its own routes, content,
presentation, accessibility, build, and deployment.

## Initial implementation sequence

This ADR is implemented only after ADR-0010's Admin application foundation is
delivered. The storefront sequence is:

1. Record the completed Next.js reference-renderer evaluation.
2. Harden the SDK for explicit server and browser consumption without adding
   framework imports.
3. Create the smallest proven `storefront-core/server` behavior around public
   Catalog reads and request-scoped clients.
4. Create the smallest proven `storefront-core/browser` behavior around
   session, CSRF, cart, and checkout integration.
5. Build the Next.js App Router reference Product-list and Product-detail
   routes with Server Components and meaningful HTML streaming.
6. Add browser cart, authentication, and checkout reference flows.
7. Prove caching isolation, exact serialization, conditional exports, and a
   clean external-consumer build.
8. Prove the smallest non-Next consumer boundary without creating a second
   reference storefront product.
9. Accept ADR-0012 before implementing reusable presentation-source
   installation mechanics.
10. Create the first independent production merchant storefront and verify its
   deployment boundary.

Package abstractions are extracted from proven reference behavior rather than
designed ahead of a consumer.

## Invariants

1. Storefront rendering supports server output and meaningful HTML streaming.
2. No SDK or correctness-sensitive storefront-core package requires React,
   Next.js, Astro, TanStack Start, or another rendering framework.
3. The SDK remains a low-level, environment-neutral HTTP contract.
4. `storefront-core/server` and `storefront-core/browser` have explicit,
   enforceable environment boundaries.
5. Server-side customer context is request-scoped and never retained globally.
6. Personalized responses never enter public, static, or cross-customer caches.
7. Browser mutations follow the same-origin cookie, trusted-origin, CSRF, and
   idempotency contracts.
8. The API remains authoritative for all commerce and security decisions.
9. Merchant presentation and static content remain locally owned source.
10. Security-sensitive protocol behavior remains in versioned runtime packages,
    not copied presentation.
11. HTML streaming does not imply or require API-level record streaming.
12. Exact Money remains exact through server rendering and browser hydration.
13. The reference storefront proves the same boundary offered to independent
    merchant repositories.
14. Framework selection does not leak into the SDK or external HTTP contract.
15. React Server Component compilation and transport remain owned by the
    selected renderer, not by a supposedly universal platform artifact.
16. The Next.js reference implementation does not make Next.js mandatory for a
    merchant storefront.

## Consequences

### Positive

- Product and content pages can provide server-rendered HTML, search visibility,
  and progressive delivery.
- The platform can adopt a suitable renderer without turning it into the public
  commerce contract.
- Merchant storefronts retain complete control over presentation and static
  content.
- Shared session, cart, CSRF, and checkout mechanisms can receive centralized
  fixes through versioned packages.
- Explicit server/browser exports reduce accidental secret or browser-global
  leakage.
- Conservative cache rules protect personalized customer data.

### Costs

- Server rendering adds a storefront runtime, request isolation, caching, and
  streaming failure modes beyond a static client application.
- Independent merchant repositories require package compatibility and upgrade
  coordination.
- Copied presentation source can intentionally diverge and cannot receive
  silent upstream fixes.
- Framework-neutral package boundaries require discipline and build-time
  verification.
- Browser-only mutations leave some authenticated workflows less
  server-integrated until a focused server-mutation contract is justified.
- A renderer still must be chosen and operated even though the platform
  contract does not mandate one.

## Alternatives considered

### Require Next.js for every storefront

Rejected as a platform contract. Next.js is selected for the reference
renderer, but SDK and integration packages remain usable by other capable
server renderers. A single framework choice does not own the commerce boundary.

### Client-side SPA storefront

Rejected as the standard architecture. A pure SPA gives up server-rendered
Product content, static generation, search visibility, and meaningful HTML
streaming without reducing backend commerce complexity.

### Precompile reusable React Server Components in a platform package

Rejected as the general reuse model. React Server Components depend on renderer
and bundler protocols that are not a stable framework-neutral package boundary.
Server-safe data integration stays versioned; customizable component source is
installed locally.

### Normalize every meta-framework behind one adapter API

Rejected. Framework routing, cache directives, cookie access, metadata,
actions, islands, image handling, and RSC compilation are materially different.
An abstraction broad enough to hide those differences would either leak them
through or become another framework maintained by the platform.

### Put Product lists and checkout UI in the SDK

Rejected. The SDK is the HTTP contract. Product lists are presentation, and
checkout orchestration belongs to `storefront-core/browser`. Combining them
would couple transport, framework, behavior, and visual design.

### Put all storefront code in runtime packages

Rejected because it hides presentation source and constrains merchant-specific
composition. Only integration behavior that needs centralized fixes remains a
runtime dependency.

### Copy all integration into every storefront

Rejected because authentication, CSRF, cart, and checkout fixes would have to
be repeated across repositories and could diverge silently.

### Store merchant pages and text in the commerce database

Rejected for the current product. It creates CMS authoring, preview,
publication, permission, caching, and migration requirements. Content-as-code
is statically rendered and intentionally changed through a developer workflow.

### Add a storefront backend-for-frontend immediately

Rejected. It duplicates proxy behavior and changes authentication, CSRF,
idempotency, failure, and observability semantics. The renderer performs
server-side reads and the browser calls protected same-origin API mutations.

### Stream Product records from the API

Rejected without evidence. Bounded JSON pages combine cleanly with streamed
HTML regions and are easier to cache, retry, document, and generate into the
SDK.

### Share one hosted storefront runtime across all merchants

Rejected. It introduces tenancy, shared failure domains, central merchant
configuration, and a control plane contrary to the independent-deployment
model.

## Explicit non-goals

This decision does not introduce:

- a mandatory Next.js storefront;
- a framework-neutral promise for compiled React Server Components;
- a universal presentation promise for non-React UI runtimes;
- a generic abstraction over meta-framework routing, caching, cookies, actions,
  or rendering directives;
- a CMS, page builder, or database-driven marketing-site model;
- production merchant storefront source in the platform monorepo;
- merchant forks of backend or correctness-sensitive integration logic;
- server actions or a backend-for-frontend mutation contract;
- API-level Product streaming, SSE, or WebSockets;
- an edge-compute requirement;
- offline checkout or persistent browser mutation queues;
- a generic runtime theme engine;
- a presentation registry transport before ADR-0012;
- silent overwriting of locally modified presentation source;
- a shared multi-merchant storefront deployment;
- authoritative commerce calculation in the renderer or browser.

## Related decisions and contracts

- ADR-0001 — Platform Architecture Principles
- ADR-0002 — Repository and Workspace Boundaries
- ADR-0004 — Commerce Domain Model
- ADR-0006 — Orders and Historical Purchase State
- ADR-0007 — Exact Money and Pricing
- ADR-0008 — Inventory and Reservations
- ADR-0010 — Admin Application Architecture
- ADR-0013 — Shipping Methods, Zones, and Rate Rules
- ADR-0014 — Manual Payments and Admin Order Acceptance
- External HTTP API and SDK contract
- Authorization contract

## Acceptance and freeze policy

This ADR is accepted and frozen. The rendering capability contract,
framework-neutral SDK, server/browser integration separation, same-origin
request model, personalized cache rules, browser-mutation boundary, local
presentation ownership, and Next.js App Router as the initial reference
renderer are authoritative.

Specific cache durations, individual component designs, and page composition
may change without superseding this ADR when its invariants remain true. A
future reference-renderer change requires a recorded evaluation but does not
change the public contract when these invariants remain intact.

A mandatory rendering framework in public packages, server-side protected
mutation proxy, shared multi-merchant storefront runtime, database-owned
marketing content, or copied security-sensitive integration requires an
explicit amendment or superseding ADR.
