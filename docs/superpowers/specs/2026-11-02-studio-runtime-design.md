# Studio performance and runtime diagnostics

User request: eliminate whole-studio audio animation updates, diagnose recurring browser freezes, update Timeweb first; include shared code for client/server editions.

Use existing local PCM meters; remove the obsolete roster animation and retain state updates only for changed roster/stat rows, including track replacement. Do not alter media publication behavior.

Extend authenticated room telemetry with a bounded primary-studio runtime snapshot: browser family, browser/desktop environment, visibility, visible event-loop delay/max, long-task count/max when supported, JS heap when supported, error/rejection counters and last20 enum-only lifecycle/connection events. Existing sanitized browser.crash logging retains error categories and bundle locations. No media, tokens, raw URLs, raw user agent, arbitrary messages or device names in new runtime fields.

Persist runtime to existing hourly JSONL/archives and retention policy (default30days/512MiB). Room owner/admin can inspect latest metrics and export filtered, paginated JSON from Statistics. A bounded sessionStorage current/previous snapshot offers local export after reload, best effort when storage is available. Collection adds no React state updates. Full renderer/GPU failure cannot be reliably observed or send final data; server silence and previous samples are evidence only.

Approaches: reuse existing telemetry (chosen implementation default; existing auth/retention/export), separate logging service (unnecessary infrastructure), local-only logs (lost remote evidence). Initial deployment targets only current Timeweb web service with actual overlay preserved, tested image, previous image rollback, and zero active media sessions immediately before change. Windows/Linux packaged releases are not published automatically.
