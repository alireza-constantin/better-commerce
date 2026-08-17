# 06 — Existing-account mobile enrollment

**What to build:** Existing accounts complete required mobile verification through a safe transition, while the operational bootstrap owner can configure the authentication Provider route and the old email-only path can be retired.

**Blocked by:** 05 — Mobile OTP and optional email/password login.

**Status:** ready-for-agent

- [ ] Existing accounts receive an explicit enrollment-required state.
- [ ] Enrollment preserves account ownership and does not create duplicate Customer Profiles.
- [ ] Bootstrap access remains available only through the documented operational path.
- [ ] Retirement of the old email-only registration contract is covered by migration tests.
