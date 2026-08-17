# 11 — Versioned transactional templates

**What to build:** Staff can create, preview, test, activate, and inspect immutable Order-message template versions with allowlisted variables.

**Blocked by:** 02 — Purpose-based provider routing.

**Status:** ready-for-agent

- [ ] Template versions are purpose-specific and cannot rewrite historical Messages.
- [ ] Variable validation rejects unknown or unsafe placeholders before activation.
- [ ] Test sends are restricted and recorded.
- [ ] Rendered ordinary message text snapshots the selected template version.
