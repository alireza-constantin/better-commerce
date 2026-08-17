# 02 — Purpose-based provider routing

**What to build:** Administrators can health-check configured SMS providers, send a restricted test, and select one provider for each message purpose without affecting already-created Message intents.

**Blocked by:** 01 — Durable SMS delivery tracer.

**Status:** ready-for-agent

- [ ] Authentication, transactional/direct, Campaign, and Wishlist routes are independently selectable.
- [ ] Route changes require a health check, test message, confirmation, permission, and audit fact.
- [ ] New intents use the new route; existing intents retain their provider binding.
- [ ] Provider secrets remain deployment configuration and are never exposed in Admin.
- [ ] HTTP E2E tests cover switching, permission denial, and restart behavior.
