# @better-commerce/sdk

Generated-backed TypeScript types and thin `openapi-fetch` clients for the
Better Commerce external HTTP contract. The package contains no React,
meta-framework, commerce-rule, or mutable request-session state.

The API OpenAPI document is the source of truth. Do not hand-edit
`src/generated/schema.ts`.

With the API running locally:

```bash
pnpm --filter @better-commerce/sdk generate
pnpm --filter @better-commerce/sdk generate:check
```

## Entry points

Use the root entry point for generated types and deliberately neutral low-level
client construction:

```ts
import {
  createBetterCommerceClient,
  type BetterCommerceApiSchemas,
} from '@better-commerce/sdk';
```

The root factory does not guess credentials, cookies, origin, caching, or
runtime behavior.

Browser applications use the explicit browser entry point:

```ts
import { createBrowserBetterCommerceClient } from '@better-commerce/sdk/browser';

const client = createBrowserBetterCommerceClient();
```

It always uses `credentials: "include"` so the browser can attach the opaque
HttpOnly session cookie. The SDK cannot read that cookie.

Server renderers use the explicit server entry point and create clients per
incoming request whenever customer context is forwarded:

```ts
import { createServerBetterCommerceClient } from '@better-commerce/sdk/server';

const client = createServerBetterCommerceClient({
  baseUrl: 'http://api:3000',
  headers: {
    cookie: incomingSessionCookie,
  },
});
```

The server base URL must be absolute. Supplied headers are cloned, credentials
are omitted from the server fetch policy, and the package never reads an
ambient cookie jar. The future `storefront-core/server` layer will own the
allowlist that decides which incoming headers may be forwarded.

CSRF lifecycle, session coordination, cart behavior, checkout idempotency, and
uncertain-mutation recovery belong in `storefront-core`, not this SDK. The SDK
does not reproduce pricing, inventory, authorization, or checkout rules.

## Verification

```bash
pnpm --filter @better-commerce/sdk test
```

The verification builds the package, compiles clean browser and server consumer
fixtures through the published entry-point map, and checks browser credential
defaults, cloned request-scoped server headers, and server base-URL rejection.
