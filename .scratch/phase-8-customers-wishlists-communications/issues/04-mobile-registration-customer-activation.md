# 04 — Mobile registration and Customer activation

**What to build:** A new Customer registers with display name, Iranian mobile, optional email, and conditional password, verifies an OTP, and atomically activates User and Customer Profile.

**Blocked by:** 01 — Durable SMS delivery tracer; 02 — Purpose-based provider routing; 03 — Mobile-ready Identity expansion.

**Status:** ready-for-agent

- [ ] Registration creates pending User and Customer Profile without creating a session.
- [ ] OTP limits, expiry, resend behavior, and enumeration-safe responses match the approved policy.
- [ ] Successful verification activates both records or neither.
- [ ] Pending registrations expire and can be safely retried.
- [ ] HTTP E2E tests cover concurrency, abuse limits, and provider failure.
