# 15 — Campaign scheduling and delivery

**What to build:** Staff can immediately send or schedule a Campaign; confirmation freezes content, Promotion version, Provider route, and audience, then durable batches deliver it.

**Blocked by:** 14 — Campaign drafting and review.

**Status:** ready-for-agent

- [ ] Campaign lifecycle follows draft, scheduled, sending, completed, or cancelled.
- [ ] Audience expansion respects the 50,000-recipient bound and current messageability.
- [ ] Tehran-time scheduling and worker restart recovery are deterministic.
- [ ] Provider acceptance, delivery, failure, unknown, and stopped outcomes are tracked.
