# Guest network reminder and distribution implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publish the approved mini statistics and tiny network reminder in the repository, hosted web and supported installer channels.

**Architecture:** Extend the existing GuestMiniStats with a native positioned popover. Preserve the measured RTP sampler and stable freshness reference. Build the supported products from one checked main source; the Windows client displays the selected server's web UI.

**Tech Stack:** Next.js/React/TypeScript, CSS modules, native Popover API, Node tests/Chromium, existing official Docker/Electron/PowerShell packaging and verified release publisher.

**Spec:** `docs/superpowers/specs/2026-11-13-guest-network-help-design.md`

## Global constraints

- Preserve Console A, mounted media, current grading thresholds and explicit/manual update behavior.
- Keep RU/EN/zh-CN copy, honest unknown/stale values and identical-sample render skipping.
- Integrate current main7fa930f and its later fixes; do not publish hosted operational records.
- Client1.0.1; web/Server Setup/Linux/Source1.0.4. Freeze one verified main SHA.
- Preserve published artifacts/drafts, user data/configuration and neighboring services.

## Review focus

- Five compact cards in1280×540 remain visible when help is closed.
- Top-layer help stays reachable near viewport/scroll boundaries and in all locales.
- Updating values preserves the open help, focus, video nodes and streams.
- Unknown data has a working reminder and no invented numeric measurement.
- Setup's Linux transport belongs to its own exact release; no WSL prerelease promotion.

### Task1: Common statistics and reminder

Files: `apps/web/components/{GuestMiniStats.tsx,GuestVideoCard.tsx,GuestVideoCard.module.css,StudioWorkspace.tsx}`, `apps/web/lib/{guest-receive-bitrate.ts,i18n/workspaces.ts}`.

Interfaces: GuestMiniStats consumes measured receive rates, existing stability and stable freshness reference; produces per-guest native popover controls without changing media ownership.

- [x] Transfer only the previously verified runtime/statistics changes onto current main.
- [x] Add failing `network-quality-help.cjs` assertions for unique controls, all grades and exact explanatory thresholds.
- [x] Implement the tiny SVG chevron, positioned popover, current measurement and three locale messages.
- [x] Preserve the existing card's noncompact settings behavior and render-skipping test.
- [x] Run focused tests, TypeScript and real-browser layout/focus/media/locale proof.

### Task2: Source and release preparation

Files: `package.json`, `distribution/release-tracks.json`, `CHANGELOG.md`, translated release notes and public manual catalog.

Interfaces: one verified main SHA supplies the official product/version metadata and all build inputs; published asset URLs are filled only after release verification.

- [x] Set Client1.0.1 and server/source1.0.4; record concrete notes in all three languages.
- [x] Run stable web CI, relevant desktop/packaging/release tests and browser proofs.
- [x] Reconcile concurrent microphone processing PR#24 and verify the combined source before freezing or publishing.
- [ ] Commit, open the focused PR, verify checks/review and merge without overwriting newer main work.
- [ ] Freeze the actual merged main SHA, preserving the prior deployed source and rollback.

### Task3: Packages and hosted rollout

Interfaces: official producers consume the frozen SHA; their manifests/checksums are the only inputs to the publisher and download selectors.

- [ ] Build official full server images once for equal server versions; validate matching third-party sources and isolated smoke tests.
- [ ] Assemble Setup and Linux independently, including Setup's own Linux transport.
- [ ] Build/check Windows Client1.0.1 and its bundled setup provenance; prepare exact source archives.
- [ ] Upload verified drafts; publish Source, Server Setup, Client, then Linux last as Latest.
- [ ] Verify every published asset and update repository/site downloads to those exact releases.
- [ ] Install the hosted web using fresh quiet-session guards, preserved public files and rollback; verify HTTPS build/assets independently.
- [ ] Record actual source/build IDs, checks, published URLs and any remaining installation actions.

## Concurrent audio integration

The microphone noise/echo toggle is maintained in PR#24. A trial merge found only translations, changelog, release metadata and generated file-map conflicts. Preserve both feature sets, both CI registrations and Client1.0.1; regenerate the combined catalog. Do not publish competing server builds under one version or deploy over an unintegrated audio update.

Ruling: the parallel microphone update owns server version1.0.3 and its publication. This branch reserves server/source1.0.4 and Client1.0.1, depends on the final merged audio source, and must publish after that update completes. This prevents conflicting artifacts and concurrent hosted web replacement.
