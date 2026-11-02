# Primary studio diagnostics

[Русский](../../STUDIO_DIAGNOSTICS.md) · [简体中文](../zh-CN/STUDIO_DIAGNOSTICS.md)

Audio meters now update inside their own components instead of updating the participant roster every animation frame.

After updating the server, reopen the primary studio in your browser or Windows Client. Open **Statistics → Primary studio diagnostics**. The latest received data refreshes with Statistics approximately every15seconds; samples are sent approximately every2seconds. Stale data is marked.

Measurements include tab visibility, main-thread timer delay and session maximum, JavaScript error/rejection counters, and JavaScript heap and long tasks when supported. Unsupported measurements are unknown, not zero. Background timer throttling is not counted as a visible-interface stall. JavaScript heap is not total tab or GPU memory.

**Studio diagnostics → JSON** exports the selected period/day/participant/session; select the Studio role for primary-studio evidence. Downloads are capped at50000samples or20MiB and marked partial when truncated. Existing studio-owner/room-admin permissions apply; platform history requires super-admin.

**This tab's log → JSON** works independently of server statistics. A bounded current/previous-session snapshot is saved in sessionStorage roughly every10seconds and on visibility/teardown events. Reload preserves the preceding session in the same tab/origin when storage is allowed. Closing the tab can remove it. With storage blocked, available current data remains in memory.

Server samples use existing hourly JSONL files under `${STUDIOLINK_STATS_DIR}` or `${STUDIOLINK_DATA_DIR}/stats/<room-hash>/<hour>.jsonl`; older hours become `.jsonl.gz`. Default retention is30days with a shared512MiB disk cap, which can shorten the available period. Existing sanitized browser errors appear as `browser.crash` in web-service logs (`docker logs` or the installation's normal log). Check full server logs before sharing them.

New runtime fields contain no media recordings, passwords, tokens, full URLs, device names or arbitrary error messages. Existing server statistics exports include participant names/identities; share only with incident investigators.

A complete renderer/GPU crash or process exit may prevent a final sample. Gaps and preceding measurements narrow the investigation but do not prove a cause. After an incident, export server JSON for that time and the original tab's local log, and record the time and screen appearance.

Timeweb and standalone servers update separately. Other installations need updated Windows/Linux server packages; updating a Client EXE does not update its server. A client opening an updated server receives the new studio web code after reloading.
