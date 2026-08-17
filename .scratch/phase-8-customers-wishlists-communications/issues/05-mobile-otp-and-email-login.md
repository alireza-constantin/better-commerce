# 05 — Mobile OTP and optional email/password login

**What to build:** Activated Customers can choose mobile OTP login or verified email/password login, with clear Persian recovery states and safe abuse handling.

**Blocked by:** 04 — Mobile registration and Customer activation.

**Status:** ready-for-agent

- [ ] Mobile OTP login works for every activated Customer.
- [ ] Email/password login is available only after email verification.
- [ ] Invalid, expired, and rate-limited requests do not reveal account existence.
- [ ] Sessions and logout behavior remain compatible with existing Identity flows.
- [ ] Storefront browser tests cover desktop/mobile keyboard and accessibility paths.
