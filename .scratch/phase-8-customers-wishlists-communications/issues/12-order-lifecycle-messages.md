# 12 — Order lifecycle messages

**What to build:** Order lifecycle facts create exactly one durable Customer Message for submitted, accepted, rejected, manually confirmed payment, cancelled, and completed states without blocking commerce.

**Blocked by:** 11 — Versioned transactional templates.

**Status:** ready-for-agent

- [ ] Each Order/purpose pair creates at most one Message intent under replay.
- [ ] Order state commits even when the provider is unavailable.
- [ ] Rendered text and template version remain historically explainable.
- [ ] API E2E tests cover rollback, retry, duplicate facts, and provider outage.
