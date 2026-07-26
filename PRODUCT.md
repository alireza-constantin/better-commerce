# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are merchants and their authorized staff operating one
independently deployed commerce store. Shoppers use a separate customer-facing
storefront.

Administrative roles include an owner, administrators, and permission-scoped
staff responsible for Catalog, Pricing, Inventory, Shipping, Orders, payments,
support, marketing, and reporting.

## Product Purpose

Better Commerce is a reusable commerce platform that lets one maintained
codebase power multiple independently deployed merchant stores without
merchant-specific forks of business logic.

Success means a merchant can operate a bespoke store while commerce,
authentication, authorization, and operational correctness remain centrally
maintainable.

## Positioning

Each merchant receives an independently deployed API, database, Redis session
boundary, Admin application, and bespoke storefront. Presentation may diverge
through locally owned source while commerce rules remain shared through the API
and versioned contracts.

## Operating Context

Admin operators manage Products, Variants, prices, stock, Shipping
configuration, Orders, manual payments, staff access, and audit history.
Customer-facing storefronts have independent content and presentation
lifecycles.

The expected fleet is small initially and grows gradually. The architecture
favors explicit, understandable mechanisms over a SaaS control plane,
microservices, or speculative fleet infrastructure.

## Capabilities and Constraints

- The backend is a NestJS modular monolith and is authoritative for commerce
  and security decisions.
- PostgreSQL owns persistent state and Redis owns opaque browser sessions.
- Admin is a fully client-rendered React and Vite SPA using TanStack Router,
  TanStack Query, source-owned shadcn/ui components, and Zustand only for proven
  client-only state.
- Storefronts support server rendering and streamed HTML without making the SDK
  dependent on a rendering framework.
- Exact Money uses decimal strings plus currency and is never authoritatively
  calculated with binary floating point.
- Each store is an independent Docker deployment with its own data, secrets,
  backups, and operational lifecycle.
- Merchant presentation and content may be changed independently; backend
  business logic may not be forked.
- A CMS, multi-merchant control plane, microservices, dynamic runtime plugins,
  and online payment gateways are outside the current scope.

## Brand Commitments

The product name is Better Commerce. No logo, typeface, palette, or durable
visual identity has been approved yet.

## Evidence on Hand

Accepted architecture decisions, behavioral contracts, a working API, a
generated TypeScript SDK, and automated backend verification exist in this
repository. No production merchant imagery, testimonials, benchmarks, or
commercial claims are available and future interfaces must not fabricate them.

## Product Principles

- Build for today's scale without blocking credible growth.
- Keep business and security authority in owned backend modules.
- Prefer configuration and explicit contracts over merchant forks.
- Let storefront presentation diverge while critical integration stays
  versioned.
- Favor commerce correctness and operational clarity over cleverness.

## Accessibility & Inclusion

Administrative and customer purchase workflows target WCAG 2.2 AA. Interfaces
must support keyboard operation, visible focus, semantic labeling, sufficient
contrast, accessible error association, and responsive use.
