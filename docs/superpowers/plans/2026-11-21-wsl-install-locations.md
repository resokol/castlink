# CastLink WSL installation locations implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install CastLink WSL in a chosen local folder and move an existing server there without losing data, discovery, management or recovery.

**Architecture:** Keep the existing pinned installer and lifecycle trust boundaries. Add a private per-user location registry and a durable, same-release WSL move operation. Preserve old AppData discovery and require an ordinary explicit upgrade before moving a release whose own installer forbids external folders.

**Tech Stack:** PowerShell 5.1, WPF, Windows ACL, WSL2 official management commands, existing Python guest helper and Node release tooling.

**Spec:** `docs/superpowers/specs/2026-11-21-wsl-install-locations-design.md`.

## Global Constraints

- Windows11, existing WSL minimum retained unless real command support requires a documented increase. NTFS local volumes, spaces/Cyrillic supported; no UNC, reparse points or drive-root installation.
- Current published release files and hashes remain immutable. No patching an old pinned installer. No Node2 action.
- No global WSL shutdown, unregister for moving, broad directory deletion or changes to parent-directory ACL.
- Move preserves one WSL registration, current product version and data, plus prior running/stopped and task preference.
- The location registry is discovery metadata, never authority to execute unverified paths.
- New updater remains compatible with installed protocol1 bootstraps: retain its eight-asset package and single Windows engine file.

## Review Focus

1. A source selected through an old logical root already points to an active generation elsewhere: move the actual VHD and keep one stable logical identity (task2 fixtures).
2. A disk is absent or an old folder was copied: report unavailable/conflicting identity; never adopt the first match (tasks1/3).
3. WSL move returns an error after changing registration: recovery checks actual registration before retry (task2).
4. The source was stopped: verification must not make its service publicly available (task2).
5. New code is packed but old source startup is pinned: gate move/restore with explicit capability, and verify every packaged helper (tasks2/4).

## Interfaces

`installation.json` retains schema1; new installs set `locationContract='castlink-wsl-location-v1'`. New release manifest declares `lifecycle.locationContract` with that value. Old records without it are readable but must be explicitly upgraded before Move.

Location registry: `%LOCALAPPDATA%\CastLinkServerRegistry\installations.json`, schema1, owner `castlink-wsl-location-v1`, current SID, `installations` array. Each row has `logicalId` (logicalInstallationId or installationId), `selectedRoot`, `activeRoot`, `installationId`. No commands or secrets. Private ACL and exclusive lock; atomic writes.

Installer APIs, implemented in the standalone installer itself (no extra file needed before first package download):

- `Assert-CastlinkInstallRoot([string]$Root)` returns canonical absolute local NTFS path, checks root/ancestor links and reserved roots without creating/modifying parents.
- `Get-CastlinkLocationRecords()` returns validated registry rows or empty if absent; malformed/private-ACL failure is an error.
- `Register-CastlinkLocation([string]$SelectedRoot,$State)` validates owned active receipt, serializes one identity entry under registry lock; replaces same logical identity only with matching current location or an explicit lifecycle-controlled switch.
- `Set-CastlinkLocation([string]$SelectedRoot,$State,[string]$ExpectedSelectedRoot,[string]$ExpectedActiveRoot)` compare-and-swap for lifecycle publication. Missing entry may be registered only after source identity proof; conflicting existing row must fail.
- `Remove-CastlinkLocation([string]$LogicalId,[string]$ExpectedSelectedRoot)` only removes the exact matching entry.

The lifecycle imports these APIs from verified new installer modules; updater independently reads the small same-format registry through its existing private-path/receipt verification. No new Windows updater asset.

Move API: `Invoke-CastlinkMove -InstallRoot <logical> -DestinationRoot <new> -Confirmation <distro> [-Recover] [-Adapter scriptblock] [-Progress scriptblock]`, returns context with kind `move`, phase, selectedRoot, destinationRoot and logicalId. Main lifecycle exposes `-Action Move -DestinationRoot`; `Recover` dispatches a move journal to this same engine. The API is defined by `scripts/server-wsl-location.ps1`, dot-sourced by the packaged lifecycle helper. Move journal is stored under private registry `operations/<transactionId>/journal.json`; pointers in source/destination and registry bind that exact journal. Completed retry verifies state and returns without new mutations.

### Task1: New installation paths and registry

**Owner/files:** installer worker owns `scripts/install-server-windows.ps1`, new `scripts/tests/server-windows-locations.fixtures.ps1`, and only needed changes in `scripts/tests/server-windows.test.ps1`.

- [ ] Write fixture cases: path outside AppData accepted; spaces/Cyrillic; UNC/drive-root/link/non-NTFS fail before creation; existing foreign files stay untouched; root private ACL preserved; registry two identities, CAS mismatch, corrupted/private-path record, missing disk and concurrent updates.
- [ ] Observe RED against missing APIs/current AppData-only check in native PS5.1.
- [ ] Implement Interfaces above; replace hard-coded AppData guard, add first-install folder prompt with existing default, retain noninteractive behavior and explicit root semantics. Stage registry only once real receipt proves installation ownership; completed rerun does not mutate unrelated files.
- [ ] Register prepared/ready installation consistently, including recovery after a failed registration; retain helpers' existing source/hash checks and ensure Move can rebuild paths without modifying pinned bytes.
- [ ] Run new native fixtures and existing installer tests; report RED/GREEN evidence and changed files. Do not change lifecycle/package/updater files.

### Task2: Durable migration and lifecycle location integration

**Owner/files:** lifecycle worker owns `scripts/server-wsl-location.ps1`, `scripts/server-wsl-maintenance.ps1`, `scripts/tests/server-wsl-location.fixtures.ps1`, and relevant lifecycle fixture additions.

- [ ] Write behavior fixtures with an adapter modelling actual WSL registration and crashes: active-generation source, same/cross-volume move, stopped/running, task preservation, free-space failure, late move failure, resume after each durable phase, altered destination, lost disk, duplicate identity, completed replay.
- [ ] Observe RED for missing Move API; record failures.
- [ ] Implement explicit new-capability gate. Verify actual WSL registration against receipt/guest marker and approved VHD path before stopping. Record immutable operation identity and ownership inventory before side effects. Adapter returns real evidence, not success from process exit alone.
- [ ] Implement preflight→quiesce→copy-owned-files→move-WSL→rebuild-bindings→verify→publish phases. WSL move never unregisters. Unknown outcomes reconcile actual registration; uncertain state keeps both locations and reports recovery required.
- [ ] Integrate legacy + registry discovery, lifecycle storage on chosen installation volume, location registry CAS on upgrade/restore/move/remove, path-aware restore capability. Preserve support for old AppData layouts and pinned legacy helpers. `Get-CLMRoot` must not silently execute relocated old bindings.
- [ ] Block native management for pending Move via source/destination lifecycle pointers; root integrates native guard if separate file needed. Maintain recovery accessibility after active generation moves.
- [ ] Run move and existing lifecycle native fixtures. Report exact adapter contract/actions and interfaces for UI/root. Do not change installer/updater/UI/package files.

### Task3: Updater external discovery and move entry point

**Owner/files:** updater worker owns `scripts/updater/castlink-updater.ps1`, `scripts/tests/persistent-updater-locations.fixtures.ps1`, and only needed additions to existing updater fixtures.

- [ ] Write RED cases: validated external registry row visible; missing disk remains unavailable without adoption; copied/moved receipt rejected; duplicates not silently selected; old AppData installations still visible; registry logical root resolves physical generation without disk scans; two updates retain chosen location.
- [ ] Implement safe registry reader and union discovery using existing private ACL/receipt checks. Do not trust registry file paths as executable commands. Distinguish inaccessible entries from no installed servers in UI.
- [ ] Add WSL-only `Перенести сервер… / Move server… / 移动服务器…` entry that opens verified lifecycle UI for selected logical root. Verify own installed manifest/helper inventory; old release gets an actionable explicit-upgrade message. Never use newest unrelated release for recovery or move the server automatically.
- [ ] Keep self-update package shape/protocol unchanged, Client/Linux behavior unchanged, and Refresh after operation retaining logical selection.
- [ ] Run native updater fixtures (existing and new), prove no network/product action in synthetic tests. Do not change installer/lifecycle/UI/package files.

### Task4: UI, capability packaging and compatible release production

**Owner/files:** root owns `scripts/server-wsl-maintenance-ui.ps1`, native panel guard if necessary, `scripts/package-server-wsl.mjs`, `scripts/build-server-wsl.mjs`, `scripts/server-wsl-maintenance.py`, release tracks and package-related tests/workflows.

- [ ] Test RED: new helper included and hash-pinned, locationContract round-trips rootfs/manifest, exact stable1.0.7 is allowed as source, updater retains protocol1/eight assets. Update every producer/consumer contract consistently.
- [ ] Implement capabilities and exact supported source; preserve old RC paths. Do not remove identity checks to make fixtures pass.
- [ ] Wire Move button, destination field and confirmation to task2; localize RU/EN/zh-CN. Preserve operation recovery after interruption and new-root selection. Old archive restore explains required upgrade path instead of editing pinned originals.
- [ ] Compile/parse native panel and WPF, test UI operation maps for exact selected source/destination, run relevant packager/lifecycle guest fixtures and TypeScript/stable CI as required by changed workflow scope.
- [ ] Ensure installed helper fallback/pins and public updater resolver point to capability-aware release before advertising Move. Assign unused release versions only after inspecting current releases.

### Task5: Real Windows proof, review and publication

**Owner:** root, with independent native-environment investigation and final review.

- [ ] Read-only inspect authorized Windows test host for WSL version, registered distros and a disposable second NTFS volume. Never use Node2. If real proof unavailable, keep release unpublished and clearly identify missing evidence; finish all independent code/tests/docs.
- [ ] On disposable owned fixture installation, prove install outside AppData, stop/start, Move within and across volumes, running/stopped state, prior URL/data/identity, fresh Updater discovery, two updates and interrupted-recovery. Preserve all unrelated distros/tasks/files; only clean proven test artifacts.
- [ ] Run independent whole-diff review, address consequential findings with regressions, verify exact source CI and packages. Prefer fresh review context; do not re-review unchanged successful work.
- [ ] Publish new stable WSL and updater only after real proof and package verification, update public download links/manuals, leave live hosted app and Node2 untouched. Existing user authorization covers creating/merging PRs and release/site publication; no repeated permission prompt.
- [ ] Record evidence, changed versions, real-proof limits and how to choose/move a folder in RU/EN/zh-CN docs and final response.
