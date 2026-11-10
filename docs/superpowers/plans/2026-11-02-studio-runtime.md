# Studio performance and runtime diagnostics implementation plan

Goal: remove redundant studio renders and retain browser-side evidence of freezes.
Architecture: local PCM components own audio animation; existing room telemetry carries bounded runtime snapshots. Existing stats authorization, disk budgets and export paging remain in use.
Tech stack: React19/Next15, TypeScript, LiveKit, existing CJS runtime tests.
Spec: ../specs/2026-11-02-studio-runtime-design.md

Constraints: preserve current Timeweb hosted overlay and renewed HTTP authorization; no media/device side effects; diagnostics never interrupt media; no secrets or arbitrary text in runtime fields.
Review focus: track replacement without roster churn; hidden/background throttling; unavailable storage/performance APIs; hostile runtime input and tenant isolation; stale observations/partial exports and interrupted deployment.

1. Frontend: reproduce RAF guest-state churn in runtime test; remove obsolete RAF, compare rows including track identity; prove meter/lifecycle behavior.
2. Backend: test strict runtime schema, authenticated studio-only ingestion, bounded filtered exact-sample read/retention; extend /api/stats and store.
3. Collector: test visible lag, background suppression, bounded events, storage reload/blocked storage, cleanup; attach only to primary studio telemetry.
4. Statistics: latest runtime disclosure, stale status, local JSON and bounded paginated server JSON export; test exports/filters and translations.
5. Verify: focused suites, TypeScript, production build and independent diff review. Record baseline failures separately.
6. Delivery: compare deployed overlay, preserve rollback, build exact tested source, recheck zero sessions, update Timeweb web-only, verify version/health/routes/new chunks/logging and unchanged other containers. Record exact evidence and remaining packaged-release work.
