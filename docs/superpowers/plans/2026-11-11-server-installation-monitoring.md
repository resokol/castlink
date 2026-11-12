# Server installation and monitoring implementation plan

> **For agentic workers:** Follow superpowers:executing-plans or
> superpowers:subagent-driven-development. Independent file ownership below.

**Goal:** One-command Linux installation, Docker-free Windows WSL2 server, real server graphs.
**Architecture:** Reuse Linux Compose installer; distribute a prepared Ubuntu systemd rootfs
for Windows; extend existing Super Admin authorization and interface for metrics.
**Tech Stack:** Bash/Python3, PowerShell5, systemd, Next15/Node22, PostgreSQL16, LiveKit/Caddy/HAProxy.
**Spec:** ../specs/2026-11-11-server-installation-monitoring.md

## Global constraints

- Preserve installation data/IDs/secrets; no automatic reinstall/update/adoption.
- Bind distribution assets to exact version/source/repository/checksums.
- Windows11 22621+ x64, WSL2 mirrored networking; no Docker in deployed Windows runtime.
- Existing authentication, media admission and isolated PPTX remain effective.
- No public publishing or production/user-PC changes in this task.
- Separate source tests, package checks and genuine target-OS verification in reporting.

## Review focus

- Interrupted download/import leaves resumable owned state without adopting unrelated data.
- Shell/PowerShell arguments cannot turn addresses/paths into commands.
- Global WSL settings and other distributions survive setup unchanged or explicit refusal.
- Stale/unavailable samples never appear as zero or as healthy service confirmation.
- Wrong-source package or frontend asset/runtime version mismatch refuses installation.

### Task1: Linux bootstrap — GPT-6.1 Sol high

Files: scripts/install-server.*, scripts/package-server-bootstrap.mjs,
scripts/tests/server-bootstrap*; root integrates package-simple-easy-setup.mjs.

- [x] Write and run failing tests for self-contained pipeline execution, package integrity,
  malformed tar, existing unrelated state, rerun preservation and subprocess failure.
- [x] Implement buildServerBootstrap({root,output,product}) and pinned Bash asset.
- [x] Reuse linux-compose init/start with tty for prompts; run the focused tests.
- [x] Integrate generated asset into Linux SHA256SUMS and package tests.

### Task2: WSL runtime — GPT-6.1 Sol high

Files: scripts/server-wsl-runtime.py, infrastructure/server-wsl/* except Dockerfile,
scripts/tests/server-wsl-runtime*.test.py.
Produces /usr/local/bin/castlink-server init/start/status/stop. State /var/lib/castlink-server.

- [x] Write and run failing config/data-preservation/validation tests.
- [x] Generate scoped service configs; bootstrap DB and verify installed version.
- [x] Preserve converter isolation and TLS443 relay. Run focused tests/unit validation.

### Task3: Windows import and controls — GPT-6.1 Sol high

Files: scripts/install-server-windows.ps1, scripts/tests/server-windows*.
Consumes pinned server-wsl manifest and rootfs; calls Task2's CLI.

- [x] Write/run failing PowerShell behavior and parser fixtures.
- [x] Implement OS/WSL checks, bounded verified download/import, preserved state,
  safe mirror configuration, Install/Start/Stop/Status.
- [x] Verify PowerShell tests, distinguishing Linux parser proof from Windows integration.

### Task4: Package/build integration — root Codex

Files: infrastructure/server-wsl/Dockerfile, scripts/package-server-wsl.mjs,
scripts/build-server-wsl.mjs, scripts/tests/package-server-wsl.test.mjs,
.github/workflows/server-wsl-package.yml, docs/distribution.

- [x] Write/run failing packaging tests for exact manifest, script pins and missing sources.
- [x] Implement rootfs/export pipeline without Docker runtime or installation data, legal
  notices and mandatory exact source archives; build and boot actual runtime image.
- [x] Run the full corresponding-source release package build from clean `0ce26451`.
  WSL1.0.2-rc.2 package audit/hashes pass; no public WSL release was published.
- [x] Verify generated installer bytes and checksums; attempt actual image/runtime build.
- [x] Update RU/EN/zh-CN instructions and working state with actual evidence.

### Task5: Server graphs — GPT-6.1 Sol high

Files: apps/web/**. Existing Super Admin server-wide authorization is authority.

- [x] Test measured counters, bounded history, unavailable-first-rate and denied room roles.
- [x] Implement polling API + responsive accessible real SVG charts with scope/freshness labels.
- [x] Run relevant server/auth/UI tests and typecheck; visually inspect if runtime available.

### Task6: Integration and review — root + fresh GPT-6.1 Sol high reviewer

- [x] Run only relevant full changed suites, syntax/typecheck/build and package verification.
- [x] Fresh review of auth, argument boundaries, package integrity, WSL preservation/isolation.
- [x] Fix material findings with focused regression tests and record actual limits.
- [x] Leave reviewable local branch; report target-Windows gaps and publication status.

## Integration results

- Linux/Windows packager and PowerShell profile:14 Node tests pass; Linux profiles pass.
- Runtime20 tests pass incl real TLS; actual Linux systemd/HTTPS/DB/LiveKit/TURN TLS
  and owner-to-real-metrics proof pass; stop/start preserves all tested bytes.
- Monitoring7 suites + TypeScript pass; desktop/mobile browser proof pass.
- Full web CI stops at output-source-quality.cjs:39, reproduced on unchanged main.
- Fresh Sol high review completed; material findings fixed and regressed.
- Real Windows11 lifecycle/networking/CA/firewall and external media remain release gates.
