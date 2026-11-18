# Video Diagnostics Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Download exact video history from studio statistics for freeze diagnosis.
**Architecture:** Extend current bounded getStats collection and its allowlisted ingestion; reuse exact diagnostic archive paging and bounded JSON export.
**Tech Stack:** TypeScript, Next.js/React, LiveKit, Node assert tests.
**Spec:** ../specs/2026-11-17-video-diagnostics-export-design.md

## Global Constraints
- Preserve media lifecycle, two-second sampling and existing one-second stats budget.
- Keep room/tenant authorization, filters and fixed time cutoff.
- Unsupported counters stay null; no raw RTC reports, tokens, SDP or device IDs.
- Download cap: 50 000 samples, 20 MiB UTF-8, 100 pages, explicit partial marker.

## Review Focus
- Old clients/archives have no new counters; still export base video data.
- Audio-only records and another room must not leak into video history.
- Counter resets/publication changes must remain distinguishable by publication ID.
- Broken paging and changing cutoff must fail instead of silently mixing history.
- Slow getStats must keep the current collection deadline and teardown behavior.

### Task 1: Collect and sanitize video diagnostics
**Files:** lib/video-diagnostics.ts, lib/telemetry-types.ts, lib/rtc-telemetry.ts, app/api/stats/route.ts (under apps/web).
**Interfaces:** videoDiagnostic(stat, source, pair, track) and sanitizeVideoDiagnostic(value); StreamStat.video optional.
- [x] Add/run failing behavioral tests for supported/null/invalid fields, linked capture, publication metadata, and actual telemetry collection.
- [x] Implement optional allowlisted metrics using the existing stats report and sanitize during API ingestion.
- [x] Run video tests and audio/runtime telemetry regressions.

### Task 2: Exact video archive history and API
**Files:** lib/telemetry-store.ts, lib/node-history.ts, app/api/stats/route.ts; tests/video-diagnostics-api.cjs.
**Interfaces:** readVideoHistory(room, minutes, options) returns exact paginated video-only samples with client/server timestamps.
- [x] Add/run failing tests for paging, filters, legacy records, authorization, sanitized ingest and gzip cursor continuity.
- [x] Extend diagnostic mode with video; wire local/node API dispatch and preserve limits.
- [x] Run video API and existing audio/runtime/relay tests.

### Task 3: Download control and verification
**Files:** components/StatisticsDashboard.tsx, lib/i18n/workspaces.ts, lib/i18n/workspace-extra.ts as appropriate; tests/statistics-video.cjs; docs/WORKING_STATE_RU.md.
**Interfaces:** videoHistoryJson(statsUrl, fetchPage?) returns content/count/partial; UI invokes it with current filters.
- [x] Add/run failing tests for button/download, fixed cutoff, filters, repeated cursors, UTF-8 caps and legacy metrics.
- [x] Add JSON control beside audio, localized status/error/help text; preserve runtime export behavior.
- [x] Full stable CI: 370 tests passed across original run and resume after regenerating required file catalog; targeted fixes and web TypeScript passed.
- [x] Leave a reviewable feature branch without publishing or changing the live server.

## Verification and final review

- Each new collector/API/export test was run RED before implementation, then GREEN.
- Fresh reviewer: GPT-6.2 Astra. Two important findings reproduced and fixed with RED→GREEN tests: explicit initial cutoff/paging validation; optional video enrichment exceeding the existing 100,000-byte POST budget.
- Final targeted audio/runtime/relay/video tests, web TypeScript and i18n passed.
- Real Chromium1440/390: JSON file contents/name, six-hour period, fixed cutoff, partial file/status, HTTP failure and no browser errors passed. API fixture, no SFU/physical camera proof claimed.
- Stable CI: first 272 tests passed, required generated file map updated, remaining 95 plus 3 reserve variants passed (370 total). Logs: /tmp/castlink-video-ci{,-resume}.log.
- Runtime/dependency lockfiles unchanged. No live server, publication or release action.
