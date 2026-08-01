# Single-merchant deployment and recovery baseline

## Purpose and current status

Each merchant receives an independent deployment: its own application runtime,
PostgreSQL database, Redis instance or namespace, object-storage bucket,
secrets, and backup set. No deployment shares customer data with another
merchant.

This document defines the target operating model. It is **not** a production
launch procedure yet: production remains blocked until reviewed migrations,
the email-verification delivery integration, and production container images
for the API and storefront are implemented.

## Target topology

Use one HTTPS public origin per merchant wherever possible:

```text
https://store.example.com/          storefront renderer
https://store.example.com/admin/    static Admin application
https://store.example.com/api/      API through a private upstream

API -> private PostgreSQL
API -> private Redis
API -> managed S3-compatible object storage
```

Only the reverse proxy/load balancer is public. PostgreSQL, Redis, and object
storage write credentials remain private. The Admin and API share the same
public origin so session cookies and CSRF protection do not require browser
access to a separate API host.

For each merchant, use a separate DNS name, secret set, database, Redis
namespace/instance, and storage bucket. Never solve merchant separation with
application-level customer IDs in this deployment model.

## Pre-launch gates

Do not accept production traffic until all of these are true:

1. API, Admin, and storefront images are built from one reviewed commit and
   have passed `pnpm typecheck`, `pnpm test -- -- --runInBand`, and
   `pnpm test:e2e -- -- --runInBand`.
2. Production schema migrations and their rollback procedure exist. TypeORM
   synchronization must remain disabled in production.
3. `TRUSTED_ORIGINS` contains only the merchant's exact HTTPS origin.
4. `SESSION_SECRETS` and abuse-protection HMAC secrets are unique random
   secret-manager values; none are copied from `.env.example`.
5. PostgreSQL and Redis use least-privilege credentials, private networking,
   encryption in transit, and health monitoring.
6. Public registration is enabled only after transactional email verification
   is connected and the release-security checklist is complete.
7. The reverse proxy serves `/admin/`, `/api/`, and storefront routes under the
   agreed HTTPS origin; readiness controls traffic and liveness controls only
   restarts.
8. A backup restore drill for this merchant has passed.

## Release procedure after the gates exist

1. Build immutable, versioned images from the release commit. Record the
   commit/tag, image digests, and public Admin build version.
2. Apply the reviewed database migration before routing traffic to code that
   requires it. Capture the migration output with the release record.
3. Deploy the API first and confirm `/health/live` and `/health/ready`.
4. Deploy the Admin and storefront artifacts, then verify same-origin browser
   authentication, CSRF, catalog browsing, cart checkout, and the admin
   manual-payment acceptance flow.
5. Keep the previous application image available. Roll back application code
   only when the migration is explicitly backward-compatible; otherwise use
   the reviewed database rollback procedure.

## Backups and restore drill

Back up PostgreSQL and merchant object-storage data on the same schedule, with
encrypted, access-controlled retention. PostgreSQL is the authoritative source
for identities, catalog, orders, inventory, and audit history. Object storage
contains product media. Redis session data is deliberately not restored:
customers may need to log in again after a Redis loss.

At least once before launch and after any major persistence change, rehearse a
restore in an isolated environment:

1. Restore the PostgreSQL backup and the matching object-storage recovery
   point into new, non-production resources.
2. Start the release image with a fresh Redis session namespace and the
   restored database.
3. Confirm readiness, catalog/media access, admin authorization, a customer
   login, an order-history read, and inventory/order consistency.
4. Record the restore duration, recovery point, release version, and any gaps.
5. Only then update the documented recovery objective for the merchant.

Never test a restore by overwriting a live merchant database. During an actual
incident, preserve the failed database and logs for diagnosis before switching
traffic to a verified restored environment.

## Incident boundaries

- A Redis outage fails authenticated traffic closed; follow the Redis-outage
  procedure in [local development and authentication operations](local-development.md).
- A session-secret compromise requires forced logout and secret rotation; use
  the same runbook.
- A PostgreSQL or object-storage recovery requires the restore drill above.
- Do not use `pnpm db:reset` outside disposable local development.
