# Server Pair Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Restore an existing server pair on another computer without files from the old computer.

**Architecture:** A ten-minute capability grants replacement of one exact peer. Destination import prepares a candidate, persists the reverse through the local application operator and commits the source after verified TLS and signed health. Durable profile transactions preserve scope and unrelated state and permit identical retries.

**Tech Stack:** Existing Node ESM, Next/React TypeScript, PowerShell and Python; no new dependency.

**Spec:** `docs/superpowers/specs/2026-11-11-server-pair-recovery-design.md`

## Global Constraints

- Ten-minute expiry, 256-bit random token, digest-only persistence.
- Preserve existing pair ID/label/scope, other peers, immutable local UUIDs and active broadcasts.
- Room creator only owns their room peers; global recovery requires operator/Super Admin.
- Normal HTTPS CA/hostname verification and public DNS policy remain enforced.
- No code in URL, argv, logs, browser storage or committed operator receipts.

## Review Focus

- Lost prepare/register/commit responses must permit the identical request to resume.
- A code claimed by one candidate must reject another candidate, including races.
- Removal, credential rotation and scope changes must invalidate pending recovery.
- Active reserve authority and transfers must block replacement through every entrypoint.
- Recovery must survive destination process restart without changing installation UUID.

## Interfaces

Core module `scripts/server-recovery-store.mjs` (and `.d.mts`):

- `serverPeerBinding(peer): string` canonical digest.
- `issueServerRecovery({peerId, authority, assertAuthorized}, env?): Promise<{code,expiresAt}>`.
- `revokeServerRecovery({peerId,assertAuthorized}, env?): Promise<{revoked:true}>`.
- `parseServerRecoveryCode(code): {version:1,origin,installationId,ca?,grantId,token,expiresAt}`.
- `prepareServerRecovery({grantId,token,identity,secret}, env?): Promise<RecoveryContext>`.
- `commitServerRecovery({...input,assertAuthorized}, env?): Promise<{ok:true,peer}>`.
- `RecoveryContext = {peer, previous, source, authority, committed}`; all peers contain secrets, internal-only.
- `authority = {kind:'installation'} | {kind:'room',studioId,roomId,version}`.
- Profile-store `replaceServerPeer({peer,expectedBinding:string|null,assertAuthorized},env?)` and
  `replacePeerViaOperator(peer,expectedBinding,env?)` reuse the application queue.

Management API `/api/server-recovery`: GET profiles (Super Admin only); POST
`{action:'issue'|'revoke',peerId,room?,studioId?}` with same-origin authorization.
Issue response `{code,expiresAt}`, revoke `{revoked:true}`.

Bridge API `/api/server-recovery/bridge`: POST `{action:'prepare'|'commit',grantId,token,identity,secret}`,
Origin absent. Prepare returns `{ok:true,source,peerId,scope,expiresAt?}`; commit
returns `{ok:true,profile:{id,label,origin,installationId}}`. Never return peer secrets.

Destination client `scripts/server-recovery-client.mjs` exports
`recoverServerConnection(code, {env?,requestPeer?,replacePeer?}?)` and a stdin CLI:
`{action:'recover',code}`; stdout only `{ok:true,profile:{id,label,origin,installationId}}`.
Local operator issue action `{action:'recovery-code',peerId}` returns code to its trusted caller.
Server profile HTTP operator accepts `{action:'replace',expectedInstallationId,peer,expectedBinding}`
under its existing setup-token authentication and reserve/transfer guards.

### Task 1: Durable recovery protocol and profile replacement

**Owner:** reserve_inventory. Files: profile-store runtime/types/tests and new recovery-store runtime/types/tests.

- [x] Write and run failing lifecycle, retry, expiry, revocation, stale-binding and concurrency tests.
- [x] Implement the core interfaces above with atomic profile/grant writes and shared existing queue.
- [x] Verify existing profile tests plus new recovery tests; report exact commands/results.

### Task 2: Authorized web APIs and active-operation guards

**Owner:** root. Files: recovery management/bridge routes, web facade, profile-removal guard extension,
operator route, focused API/security/guard tests and runtime script allowlist.

- [x] Add failing tests for scope escalation, stale creator, wrong Origin, private/redirect TLS targets and active guards.
- [x] Implement management authorization and prepare/commit bridge with real transport and signed harmless health proof.
- [x] Guard replacement on both servers, retain removal behavior, update operator with expected binding.
- [x] Run focused API, reserve/transfer/profile tests and TypeScript.

### Task 3: Destination import and platform entrypoints

**Owner:** server_stable_operator. Files: recovery-client runtime/types/test, Windows control panel,
Linux setup recover command, platform fixtures and new language strings in installer language helper.

- [x] Write failing two-side client retry tests and entrypoint fixtures.
- [x] Implement code import with verified transport, deterministic shared key and stdin-only operator calls.
- [x] Add Windows UI and Linux hidden-input command with explicit retry errors, no service restart.
- [x] Run focused Node/Python/PowerShell fixtures, reporting any unavailable platform check.

### Task 4: Source recovery controls and user instructions

**Owner:** client_stable_operator. Files: new recovery code component, room connections, Super Admin page,
management translations and corresponding UI/API interaction tests; root owns public instructions.

- [x] Write failing scope/expiry/cleanup UI tests.
- [x] Add issuer controls using the management API; clear codes on close/context change and never store them.
- [x] Show only room peer buttons to room creators; use Super Admin listing for global peers.
- [x] Run component checks and TypeScript when core API dependencies are ready.

### Task 5: Integrated verification and delivery

**Owner:** root, independent reviewer stable_release_review.

- [x] Prove new UUID/CA recovery and restart persistence using temporary installations.
- [x] Run focused suites, complete CI, typecheck and production build.
- [x] Independently review security, partial failure, scope and concurrency; fix verified findings.
- [ ] Synchronize RU/EN/zh-CN instructions and release notes; commit verified source, prepare publishable change.
- [ ] Read current production activity before any authorized deploy; never interrupt a busy installation.
