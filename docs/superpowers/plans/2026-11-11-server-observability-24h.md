# Server observability24h implementation plan

> Follow superpowers:test-driven-development and verification-before-completion.

**Goal:** Persistent24h measurements and a bounded event/error journal.
**Architecture:** Builtin Node SQLite + one startup sampler; authenticated read-only
APIs; existing Super Admin charts and a paginated journal. No external service.
**Spec:** ../specs/2026-11-11-server-observability-24h.md

## Constraints and review focus

Data/credentials and room permissions remain unchanged. Both API endpoints require
platform session before storage reads. No sample on HTTP reads. No duplicate timers,
unbounded queues, unbounded DB/WAL, raw secret output or build-time background work.
Missing data and gaps differ from zero; aggregated peaks differ from current raw values.
Windows/production/public releases are outside this source change.

### Task1 — GPT-6.1 Sol high, backend

Own lib/server-monitor*, observability/event store/types/worker, server-log.ts,
instrumentation.ts, metrics/events routes and their backend tests.

- [x] Fail real SQLite tests for retention/restart/caps/privacy/errors and sampler.
- [x] Implement15s sampler,5760raw points/24h, bounded structured event writes,
  automatic retention and storage status; retain console fallback.
- [x] Add read-only metrics range and events level/cursor API; negative auth/query tests.
- [x] Prove peak buckets, coherent ratios and no fabricated samples across outages.

### Task2 — Codex root, frontend and integration

Own ServerMonitor.tsx/.module.css, ServerEventJournal.tsx, i18n/server-monitor.ts,
UI tests, CI list and docs. Consumes backend's typed snapshot/events contract.

- [x] Failing UI behavior/SSR tests: real range, raw-current vs peak, data gap,
  journal severity/pagination, access revocation/error/empty states.
- [x] Add1h/6h/24h controls and explicitly labelled aggregation, bounded table,
  journal filters and safe readable fields,15s visibility-aware polling.
- [x] Sync RU/EN/zh-CN docs and working state, run relevant tests/typecheck/build.
- [x] Measure storage and representative insert/read overhead; browser desktop/mobile.
- [x] Fresh focused review, regress material findings, save a local commit only.
