# Admin static delivery runbook

The Admin is a static artifact served at `/admin/` and proxied to the API at
`/api/` from the same public origin. This preserves the existing cookie and
CSRF model: the browser never receives an API host, a database credential, a
Redis credential, or a session secret.

## Build the artifact

Run the build from the repository root. `ADMIN_BUILD_VERSION` is a public,
release-safe identifier such as a Git commit SHA or release tag.

```powershell
docker build `
  --build-arg ADMIN_BUILD_VERSION=2026.07.27 `
  --file apps/admin/Dockerfile `
  --tag better-commerce-admin:2026.07.27 `
  .
```

The Docker build compiles the generated SDK before compiling Admin. CI must run
`pnpm sdk:check` against the target API contract before this image is accepted
for release.

## Deploy the artifact

Run the static Admin image behind the same public reverse proxy or load
balancer as the API. Set `API_UPSTREAM` to the API's private container or
service URL; it must not be browser-visible.

```text
https://store.example.com/admin/*  -> Admin image
https://store.example.com/api/*    -> Admin image -> private API upstream
```

For a local container smoke check against a host-run API on Windows:

```powershell
docker run --rm --publish 8080:8080 `
  --env API_UPSTREAM=http://host.docker.internal:3000 `
  better-commerce-admin:2026.07.27
```

Before using a different public origin, add that exact origin to the API's
`TRUSTED_ORIGINS` and restart the API. Production should expose one HTTPS
origin, for example `https://store.example.com`, rather than separate Admin
and API origins.

## Release checks

1. Open `/admin/diagnostics` and confirm `adminVersion` is the expected public
   release identifier.
2. Open `/admin/`, authenticate, and exercise the critical operator flows.
3. Confirm a browser request to `/api/v1/auth/me` is same-origin and carries
   only the secure session cookie; no credentials appear in the JavaScript
   bundle or static configuration.
4. Confirm a deep link such as `/admin/orders` reloads to the Admin application
   instead of returning a server 404.
5. Confirm a hashed file beneath `/admin/assets/` is cacheable while
   `/admin/index.html` is not.

The image is intentionally not an API image. The API remains its own runtime
and owns PostgreSQL, Redis, sessions, authorization, and all commerce rules.
