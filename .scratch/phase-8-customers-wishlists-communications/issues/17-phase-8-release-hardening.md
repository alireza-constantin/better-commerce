# 17 — Phase 8 release hardening

**What to build:** Verify the complete Customers, Wishlist, and Customer Communications release under provider outages, restarts, concurrency, responsive RTL browser journeys, and accessibility checks.

**Blocked by:** 06 — Existing-account mobile enrollment; 08 — Direct Customer messaging; 10 — Wishlist availability alerts; 12 — Order lifecycle messages; 16 — Campaign cancellation, reconciliation, and export.

**Status:** ready-for-agent

- [ ] Full API E2E, provider conformance, SDK, storefront-core, and production builds pass.
- [ ] Admin and storefront desktop/mobile Playwright and axe journeys pass.
- [ ] Outbox, worker, database, Redis, and provider restart/outage scenarios recover safely.
- [ ] Metrics, alerts, retention, redaction, contracts, and living documentation are complete.
