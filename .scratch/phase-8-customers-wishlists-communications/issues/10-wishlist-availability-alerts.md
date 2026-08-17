# 10 — Wishlist availability alerts

**What to build:** A Customer receives one durable Wishlist availability Message when a saved Variant transitions from not purchasable to purchasable.

**Blocked by:** 02 — Purpose-based provider routing; 09 — Variant Wishlist.

**Status:** ready-for-agent

- [ ] Catalog/Pricing/Inventory change facts trigger authoritative purchasability reevaluation.
- [ ] Duplicate facts and worker restarts create at most one alert per unavailable episode.
- [ ] Alerts reset only after a later unavailable state.
- [ ] Normal operation targets creation within one minute and exposes queued/failure state.
