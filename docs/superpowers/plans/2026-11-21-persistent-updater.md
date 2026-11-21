# Persistent CastLink Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Install a permanent local updater once, then update its own code and the appropriate CastLink product without repeatedly downloading maintenance tools manually.

**Architecture:** Independent Python 3/Linux and Windows PowerShell implementations share a fixed release manifest and test vectors. Their permanent entry points obtain verified versioned updater code; that code delegates product installation to existing product mechanisms. Platform tasks own disjoint files and can run in parallel after the contract below is fixed.

**Tech Stack:** Python 3 standard library, Windows PowerShell 5.1/WPF, Node packaging/tests, GitHub Actions/Releases.

**Spec:** `docs/superpowers/specs/2026-11-21-persistent-updater-design.md` (approved).

## Global Constraints

- Windows Client, Windows/WSL2 Server and Linux/Ubuntu Server; run on each computer, no SSH manager.
- Stable releases only, no downgrade, no common releases/latest for product selection.
- Preserve actual installation identities and state paths; confirmation before applying product updates.
- No new Node/Electron dependency for servers, no daemon, no unexpected service restart.
- Existing published assets immutable; Node2 is updated by its owner.
- RU/EN/zh-CN messages and documentation. Use existing product transactions/recovery.
- Author-led integration with independent platform work under dispatching-parallel-agents; no extra approval gate for this already authorized implementation.

## Review Focus

- Ambiguous multiple installs or moved state paths must require explicit selection (tasks 1/2).
- Updater cache altered between runs must be reverified, and failed activation must retain previous version (tasks 1/2).
- Offline, throttled, truncated or incompatible latest release must not masquerade as no updates or downgrade (tasks 1/2).
- Installed Client and WSL coexist; selecting one must not update the other or close a live client before confirmation (task 2).
- Future updater release must refresh tools as well as select product version; test two successive versions through the same entry point (tasks 1/2/3).

## Shared release contract (all tasks)

Repository `resokol/castlink`; independent stable tag `updater-v<version>-<source SHA first 12>`; initial updater version `1.0.0`.
`manifest.json`: `{schemaVersion:1, protocolVersion:1, channel:"updater", repository:"resokol/castlink", version, sourceCommit, releaseTag, platforms:{linux:{entry:"castlink-updater.py", files:[{file,size,sha256},...]},windows:{entry:"castlink-updater.ps1",files:[...]}}}`.
Linux files: `castlink-updater.py`, `linux-compose-setup.py`.
Windows files: `castlink-updater.ps1` (self-contained bootstrap and versioned engine).
Top-level release assets: union of platform files plus `manifest.json`, `SHA256SUMS`, `install-updater-linux.sh`, `install-updater-windows.cmd`, `LICENSE`.
Only flat filenames, bounded manifest <=1 MiB, each tool <=4 MiB, numeric release ID and exact source/tag identity. All asset sizes and SHA256 digests must match metadata and manifest before any downloaded tool is executed. Reject duplicate entries and unsafe paths. Product release validation remains product-specific.
Permanent scripts invoke the newly verified script with an internal engine mode to avoid recursive discovery, forwarding validated user arguments. The updater release is separate from product releases; no additional server rebuild is needed to onboard existing installations.

### Task 1: Linux persistent command and product adapter

**Files:** Create `scripts/updater/castlink-updater.py`, `scripts/updater/install-updater-linux.sh`, `scripts/tests/persistent-updater-linux.test.py`.
**Consumes:** shared manifest contract; existing `scripts/linux-compose-setup.py` APIs.
**Produces:** `python3 castlink-updater.py install --state-dir PATH`, installed `castlink check-updates|update|updates [--state-dir PATH] [--lang ru|en|zh-CN]`, optional `--auto-check on|off` for preferences. Root/user installation paths must not overwrite an unrelated existing `castlink` command.
- [x] Write failing fixtures for stable selection, consecutive updater upgrades, bad digest/cache/link, failed activation, protocol mismatch, offline error, no restart on check/cancel, explicit multiple-state selection, preserved state identity.
- [x] Run `python scripts/tests/persistent-updater-linux.test.py`; expected meaningful failure for missing implementation.
- [x] Implement bootstrap download/atomic version activation, durable registration and command, local state validation, stable exact Linux target selection and confirmed delegation to the existing update mechanism. Auto-check preference persists; no scheduler added.
- [x] Run the new suite and `python scripts/tests/linux-updates.test.py`; expected pass. Record real command/output in ledger; commit only owned files after root integration review.

### Task 2: Windows permanent launcher, self-update and product adapters

**Files:** Create `scripts/updater/castlink-updater.ps1`, `scripts/updater/install-updater-windows.cmd`, `scripts/tests/persistent-updater-windows.fixtures.ps1`.
**Consumes:** shared manifest; installed Client metadata/registry and existing WSL receipts; target maintenance assets and manifests.
**Produces:** Windows PowerShell script with `-Install`, default graphical launcher, `-FunctionsOnly` for fixtures, `-Engine` internal mode, optional `-InstallRoot` and `-Language ru|en|zh-CN`. Shortcut installed once per user. Target chosen by identity, never arbitrary first path.
- [x] Write failing native PowerShell fixtures for stable per-product selection, two updater versions through same launcher, checksum/unsafe path/protocol errors, activation recovery, Client/WSL coexistence, cancellation and compatible WSL target selection.
- [x] Run native fixtures (and parser checks); expected missing implementation failures first.
- [x] Implement self-contained bootstrap/engine, private versioned cache and protected registration, local product detection, WPF selection with explicit confirmation and preferences. Obtain exact target WSL Windows helpers before handing off to existing maintenance; Client uses verified setup.exe only after confirmation. Preserve ongoing server operations/recovery and existing preferences.
- [x] Run all native fixtures and relevant existing WSL launch/parser tests; expected pass. No access or update to Node2. Commit only owned files after integration review.

### Task 3: Packaging, entry-point integration and release workflow

**Files:** Create `scripts/package-updater.mjs`, `scripts/tests/package-updater.test.mjs`, `.github/workflows/updater-package.yml`; integrate appropriate existing client/native-panel/Linux installer entry points without changing their published historical assets.
**Consumes:** task 1/2 filenames and command interfaces above.
**Produces:** source-pinned complete updater release package, independent version manifest and SHA256SUMS; CI with Linux tests and Windows 5.1 fixtures. Existing installed products onboard through standalone updater; future package sources include access to it.
- [x] Write failing package tests: exact platform files/bytes/hashes, rejects changed/extra/missing files, tag/source/protocol identity, source unchanged, platform tests wired into CI.
- [x] Run `node --test scripts/tests/package-updater.test.mjs`; expected failure for missing packager.
- [x] Implement `assembleUpdaterPackage({root,output,commit,version})` export in `scripts/package-updater.mjs`; no overwrites. Include both platforms and required Linux adapter. GitHub workflow builds/tests exact source and publishes only complete verified drafts, stable updater channel, make_latest=false.
- [x] Integrate native/product menu entry points through reviewed persistent launcher when installed, preserving current fallback and settings. Add behavior tests for delegation/cancel and absent updater fallback; avoid requiring server Node runtime.
- [x] Run package/entrypoint tests and platform suites; expected pass. Inspect actual generated release package.

### Task 4: Review, publication and user documentation

**Files:** Current README/guides/patch notes RU/EN/zh-CN; working state and generated manual index. Existing production website download surfaces only after verified publication.
**Consumes:** passing platform/package proof and final source commit.
**Produces:** reviewed PR merged, immutable stable updater release, permanent download links and onboarding instructions.
- [x] Synchronize user docs: one-time onboarding, exact commands, stable/manual apply behavior, data paths, recovery limits, Legacy separation.
- [x] Run relevant suites plus repository CI, inspect actual Windows UI and Linux fixture installs. Explicitly distinguish tests from live server upgrades.
- [x] Fresh independent whole-branch review; fix consequential findings with reproductions and rerun affected suites.
- [x] Create/attach PR, merge after checks; build/publish immutable updater assets from verified source. Verify complete inventory and every digest publicly.
- [x] Deploy only reviewed website links/download files with exact before-hashes and backups; no app restart or Node2 update. Read back public bytes and links. Record results and remaining limitations.

## Execution record

Progress and test logs: git-ignored `.superpowers/sdd/2026-11-21-persistent-updater/`.
Task ownership: Linux platform agent (task 1), Windows platform agent (task 2), Codex integration/packaging/docs/publication (tasks 3/4). Shared contract changes require coordinator agreement before editing another task's assumptions.
