# @better-commerce/sdk

Generated-backed TypeScript types and a thin `openapi-fetch` client for the
Better Commerce external HTTP contract.

The API OpenAPI document is the source of truth. Do not hand-edit
`src/generated/schema.ts`.

With the API running locally:

```bash
pnpm --filter @better-commerce/sdk generate
pnpm --filter @better-commerce/sdk generate:check
```

Browser clients send the server-side session cookie through
`credentials: "include"`. The package does not read HttpOnly cookies and does
not reproduce pricing, inventory, authorization, or checkout rules.
