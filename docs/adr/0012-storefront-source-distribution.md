# ADR-0012 — Storefront Source Distribution and Upgrade Workflow

Status: Accepted and frozen
Date: 2026-08-01
Accepted: 2026-08-01
Frozen: 2026-08-01

## Context

Better Commerce deliberately separates shared commerce behavior from
merchant-owned presentation. A dog-house, clothing, bicycle, or cosmetics
store should be able to start with proven Product, Cart, and Checkout
presentation without inheriting an uneditable theme package or a platform
repository fork.

ADR-0001 permits copied presentation source. ADR-0002 requires production
merchant storefronts to live in independent repositories. ADR-0011 defines
framework-neutral runtime packages and states that presentation source remains
locally owned, but intentionally defers how it is distributed, installed,
identified, and upgraded.

Unstructured copy/paste is not sufficient. It loses provenance, makes security
updates hard to find, and gives no reliable way to compare a merchant's edited
component with its platform origin. A normal runtime UI package has the
opposite problem: it hides source in `node_modules` and makes local changes
fragile or impossible.

## Decision drivers

- Merchant storefronts must own and freely edit presentation source.
- Shared security-sensitive integration must remain versioned and centrally
  maintainable.
- Merchants must be able to use different rendering frameworks.
- Source provenance and upstream changes must be visible without a SaaS control
  plane or a plugin marketplace.
- Updates must never silently overwrite merchant changes.
- The first implementation must work for a solo developer and a small fleet of
  independently deployed stores.
- Source distribution must not introduce executable remote code, secrets, or
  hidden business rules into merchant repositories.

## Decision

### A versioned source catalogue, not a runtime UI dependency

Better Commerce will publish a versioned **storefront source catalogue**. A
catalogue release contains editable presentation blocks and optional
framework-specific recipes. It is a distribution artifact, not a runtime UI
library.

A merchant uses a platform-owned command-line installer to copy selected
catalogue files into its own repository. The copied files are ordinary source:
they are committed, reviewed, tested, styled, and deployed by the merchant
repository. They are never imported from `node_modules` at runtime.

The catalogue and installer may be delivered through a private package registry
or another authenticated immutable artifact channel. That transport is
replaceable. The durable contract is that an identified catalogue release is
installed into merchant-owned source with verified integrity and recorded
provenance.

### What belongs in the catalogue

Catalogue entries are presentation only. Initial entries may include:

- Product cards, product grids, and Product detail sections;
- Cart controls, cart drawer, and checkout presentation;
- customer account and Order-history presentation;
- shared visual primitives, styles, and accessibility helpers;
- examples and tests that show use of public storefront packages;
- narrow renderer recipes such as a Next.js App Router route or Astro island.

Entries may import public `@better-commerce/storefront-core` and
`@better-commerce/sdk` entry points. They must not copy session handling, CSRF
rotation, cart synchronization, checkout idempotency, API transport logic, or
authoritative commerce calculations.

Runtime packages remain normal versioned dependencies. A catalogue block
declares the compatible runtime package range it expects. A security or
correctness fix in a runtime package is delivered by dependency upgrade, not
by trying to overwrite every merchant's copied presentation source.

### Portable blocks and framework recipes

The catalogue makes portability explicit:

- **Portable React blocks** contain renderer-compatible React source and no
  framework route, cache, cookie, image, or server-component imports.
- **Framework recipes** contain local composition for one named renderer, such
  as Next.js App Router or Astro. They may depend on portable blocks but remain
  optional and visibly framework-specific.
- **Non-React storefronts** reuse API and storefront-core contracts but provide
  their own presentation. The catalogue does not promise universal UI source.

No catalogue entry is a precompiled universal React Server Component. The
merchant renderer compiles copied source locally.

### Catalogue manifest and provenance

Every release exposes a machine-readable manifest. Each entry records at
least:

- stable entry identifier and human-readable title;
- catalogue version and immutable release identifier;
- entry type: portable block, framework recipe, shared dependency, or example;
- supported renderer(s) and required runtime package ranges;
- target-relative files, checksums, and entry dependencies;
- public configuration inputs and installation notes.

Installation writes a small merchant-repository manifest, for example
`better-commerce.source.json`. It records each installed entry, the catalogue
release, original file checksums, target paths, and required runtime package
ranges. It contains no credentials, customer data, or private deployment
configuration.

This manifest provides local provenance; the platform does not need a central
database of merchant repositories. A merchant may remove the manifest only by
giving up automated update comparison for that source.

### Installation behavior

The installer accepts an explicit catalogue version and target directory. It
must:

1. fetch an immutable catalogue artifact through the configured authenticated
   channel;
2. verify manifest and file integrity before writing source;
3. display every target file, dependency, and runtime package requirement;
4. refuse to overwrite an existing file by default;
5. write provenance only after all selected files are written successfully;
6. require an explicit option before changing `package.json` or the lockfile.

It does not execute catalogue-provided scripts, install arbitrary transitive
code outside the declared package-manager operation, read merchant secrets, or
modify platform business logic. The installer itself is a versioned,
reviewable platform tool.

The first implementation may use commands conceptually equivalent to:

```text
better-commerce-storefront add product-grid --version 1.0.0
better-commerce-storefront add next-product-route --version 1.0.0
better-commerce-storefront status
better-commerce-storefront diff product-grid --to 1.1.0
```

The command spelling is not an architectural contract.

### Updates are reviewable, not automatic

Copied files intentionally diverge. The installer therefore never performs a
blind in-place upgrade.

For an update, it compares:

```text
catalogue source originally installed
          ↕
merchant's current local source
          ↕
requested newer catalogue source
```

`status` reports available source and runtime-package updates. `diff` produces
a reviewable three-way comparison. An optional update command may apply files
only when their recorded original checksum still matches the merchant file and
the developer explicitly requests application. For modified files it writes a
proposed patch or separate update output, leaving the merchant file untouched.

The merchant resolves changes, runs its own tests, and commits the result.
There is no background sync, remote overwrite, or platform-controlled update
pull request in the initial architecture.

### Ownership and support boundary

After installation, the merchant owns copied presentation source. The platform
supports the catalogue release as an example and supports its published runtime
package contracts. It does not guarantee that locally modified component markup
or styles remain compatible with future catalogue presentation releases.

The platform remains responsible for public API compatibility, SDK behavior,
storefront-core correctness-sensitive protocols, and documented upgrade notes.
Merchants remain responsible for their routes, content, framework configuration,
presentation changes, accessibility, SEO, and deployment.

### Security and release policy

Catalogue releases are immutable, versioned, reviewed artifacts. The
installer verifies artifact integrity and records the exact release used.
Catalogue source must pass the same code review, license, secret scanning,
typechecking, and tests appropriate to platform source. It may not contain
merchant secrets, credentials, analytics keys, or hidden network destinations.

Every release must declare its compatible API/SDK/storefront-core versions.
Breaking changes use a new major version or a new entry identifier; they do not
silently alter an existing entry's meaning.

## Alternatives considered

### A shared runtime UI package

Rejected. It makes merchant customization depend on overrides or patches to
`node_modules`, hides presentation source, and couples every local visual
change to the platform release cycle.

### Manual copy/paste from examples

Rejected. It creates no provenance, integrity check, dependency record, or
upgrade path. It becomes unmanageable after several merchant storefronts.

### Database themes or a general CMS

Rejected. It conflicts with the content-as-code and bespoke storefront model,
adds a second content runtime, and makes presentation changes into operational
data mutations rather than reviewed source deployments.

### Remote runtime component loading

Rejected. Remote code changes create a supply-chain, caching, rollback, and
compatibility surface that is not justified at the expected fleet size.

### A hosted marketplace or fleet control plane

Rejected. A small private versioned catalogue and local provenance manifest are
sufficient for the initial installation count. Fleet automation can be
introduced later if manual update inventory becomes a demonstrated burden.

## Consequences

### Positive

- Each merchant gets editable presentation source without a backend fork.
- Reusable presentation has explicit origin and upgrade visibility.
- Correctness-sensitive protocols remain centrally maintained dependencies.
- Next.js, Astro, and future renderer integrations can coexist without a fake
  universal framework abstraction.
- The platform can evolve its source catalogue without storing merchant content
  or source code.

### Negative

- The platform must maintain a catalogue manifest, installer, release process,
  and compatibility notes.
- Merchant modifications require deliberate merge work for presentation-source
  upgrades.
- Some UI blocks will be renderer-specific and cannot be shared everywhere.
- A small fleet can manage update inventory manually; a larger fleet may later
  justify automation.

## Architectural invariants

1. Production merchant storefronts remain independent repositories and own
   their copied presentation source.
2. Copied presentation source is committed as ordinary merchant source, not
   hidden in a runtime dependency.
3. API, SDK, and storefront-core remain the only shared locations for
   correctness-sensitive transport, session, CSRF, cart, and checkout behavior.
4. Catalogue installation never silently overwrites an existing or modified
   merchant file.
5. Every installed entry has local provenance sufficient for update comparison.
6. Catalogue artifacts are immutable, integrity-checked, and contain no
   executable installer hooks or merchant secrets.
7. Framework recipes remain explicit local source; platform runtime packages do
   not become coupled to any renderer.
8. No merchant storefront source, merchant content, or merchant deployment
   configuration is added to the platform repository.
9. The first workflow requires no hosted marketplace, dynamic module loading,
   CMS, or SaaS control plane.

## Related ADRs

- ADR-0001 defines platform independence, no business-logic forks, and copied
  presentation ownership.
- ADR-0002 defines independent merchant storefront repositories.
- ADR-0011 defines rendering, runtime package, cache, and storefront ownership
  boundaries.
