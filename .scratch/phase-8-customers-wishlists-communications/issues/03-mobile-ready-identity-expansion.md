# 03 — Mobile-ready Identity expansion

**What to build:** Add the compatibility-safe Identity model for normalized Iranian mobile numbers, pending verification, optional email, and conditional password credentials while preserving existing authentication behavior.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Existing email/password accounts remain functional during the expand step.
- [ ] Mobile uniqueness, pending state, verification timestamp, and challenge persistence are represented safely.
- [ ] The old required-email contract remains available until migration is complete.
- [ ] Migrations and rollback/readiness checks are covered by API E2E tests.
