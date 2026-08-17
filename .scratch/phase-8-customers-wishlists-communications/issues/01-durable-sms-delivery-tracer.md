# 01 — Durable SMS delivery tracer

**What to build:** A complete testable path for a staff member to send a test SMS through a deterministic provider adapter, persist a Message intent, process it through a durable worker, and view normalized delivery history after restarts.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Message intents and Delivery attempts survive API/worker restart.
- [ ] A provider adapter returns normalized accepted, delivered, failed, and unknown outcomes.
- [ ] Retry and idempotency prevent duplicate intents or unsafe resends.
- [ ] Provider credentials, OTPs, and rendered secrets never enter logs.
- [ ] Public HTTP E2E tests cover the complete path with the deterministic adapter.
