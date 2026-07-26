# Commerce Operations Contract

Status: implemented operational contract  
Version: 1.0  
Updated: 2026-07-26

## Reservation expiry

Inventory reservations are temporary stock claims. The API runs a configurable
background sweep after application bootstrap and at a fixed interval.

- `RESERVATION_SWEEP_INTERVAL_SECONDS` defaults to `60`.
- `RESERVATION_SWEEP_BATCH_SIZE` defaults to `100`.
- one process never overlaps its own sweeps;
- multiple API replicas may sweep concurrently;
- PostgreSQL `FOR UPDATE SKIP LOCKED` assigns each expired reservation to at
  most one worker;
- reservation status, terminal timestamp, terminal reason, Inventory reserved
  quantity, and Inventory version change in one transaction;
- repeated processing is idempotent;
- a submitted Order whose reservation expired cannot be accepted.

The worker drains full batches before waiting for the next interval. Failures
are logged and retried on a later interval; they do not terminate the API.

## Commerce audit

`commerce_audit_events` is append-only application history for successful
commerce mutations. It is separate from the authorization security audit.

Each event contains:

- actor user ID, nullable only for system or direct operator actions;
- stable action key;
- target type and target ID;
- HTTP request ID when the action came from HTTP;
- action-specific allowlisted metadata;
- creation timestamp.

Audit writes participate in the same PostgreSQL transaction as their mutation.
A rolled-back mutation writes no event. Metadata rejects unknown keys, nested
objects, credentials, tokens, cookies, sessions, connection data, and request
bodies.

Initial actions cover Pricing changes, Inventory configuration/adjustment,
Shipping configuration, Order submission/acceptance/rejection, and manual
payment confirmation.

Staff with `audit.read` may read bounded pages from:

```text
GET /api/v1/admin/commerce-audit-events
```

The API exposes no update or delete operation for commerce audit events.
Retention policy and archival remain deployment concerns that must be set
before production launch.
