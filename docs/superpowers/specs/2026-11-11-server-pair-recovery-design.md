# Server pairing recovery on another computer

## Intent

The owner must be able to replace a server computer or reinstall CastLink and
restore an existing connection without any file, key or access to the old PC.
Ordinary restarts continue to use the saved pairing without interaction.

The observed node2 migration created a new immutable installation UUID and
private HTTPS CA. The source retained the old UUID and no CA, so normal TLS
verification rejected health checks. A domain name alone cannot authorize
replacing the installation, CA or shared key.

## Approach

Use a short-lived recovery code issued on the surviving source server for one
existing peer. Paste it into the new Windows Server panel, or enter it through
the Linux setup command. CastLink then updates both sides automatically.
A transfer file requires the old PC or an advance backup and does not cover
recovery when neither is available.

The code lasts exactly ten minutes. It contains the source HTTPS origin,
source installation UUID, optional source CA, random grant UUID and a random
256-bit token. It contains no existing long-lived pairing or operator secret.
The source persists only the token hash. Codes never enter URLs, process
arguments, logs or browser storage. Management responses use no-store.

## Protocol

1. An authenticated room creator may issue/revoke codes only for their room
   peers. Installation-wide peers require the installation operator or a
   Super Admin. Bind a grant to the exact existing peer including scope and
   credentials. Room grants also carry the issuer's current room credential
   version, rechecked at completion.
2. The destination operator parses the pasted code and derives a fresh shared
   key deterministically from its token, both immutable installation UUIDs
   and grant UUID. It sends its public identity and that key to the source
   over verified HTTPS. The destination origin must match the selected old
   peer origin. Public DNS may point to a different computer/IP.
3. The source claims the grant for exactly that candidate. A different
   candidate cannot reuse it. It verifies destination HTTPS and health with
   the supplied CA, retaining normal certificate and hostname validation.
   It returns its public identity and the exact pair ID and scope.
4. The trusted destination operator saves the reverse peer through the live
   application's existing profile write queue. It preserves other peers and
   uses an expected-binding check for any existing record.
5. The destination asks the source to commit. The source verifies the new
   destination's health and a signed harmless bridge health request, then
   replaces only the old peer in the application write queue. Preserve ID,
   label and scope; update installation UUID, shared key and optional CA.
   Use public DNS rather than retaining the previous pinned IP.
6. An identical retry resumes the same candidate and key, including a lost
   commit response. A completed code cannot authorize another replacement.
   Expired, revoked, malformed and stale-binding grants are rejected.

Keep recovery grants in the existing schema-1 server profile document so a
candidate/commit and its peer changes are persisted in one atomic write.
Use the same cross-route write queue as normal pairing and removal.

## Operational boundaries

- No SSH credentials are retained. No TLS bypass, global CA installation,
  hostname-only trust, account subsystem or third-party dependency is added.
- A public bridge endpoint accepts token-authorized server requests only;
  browser Origin headers are rejected, body size and rate limits apply.
- Requests use the existing peer transport, which rejects private/reserved
  DNS destinations, redirects and hostname mismatches.
- Preserve active rooms, participants, transfers, unrelated peers and data.
  Before replacing a peer, hold the reserve and transfer guards and refuse
  while any relevant reserve authority or transfer remains usable.
- Prepared reserves and room/session credentials are not restored from the
  lost PC. The owner prepares a new reserve after recovering the connection.
- No service restart is required to recover pairing. Existing installation
  UUIDs are never rewritten. The new PC keeps its own installation identity.

## User surfaces

- Room connection cards: “Восстановить связь”, code, expiry and revoke action.
- Super Admin: the same control for installation-wide connections.
- Windows Server local panel: a collapsed recovery section, code input and
  restore button, clear progress and retry-safe errors; input is cleared.
- Linux setup: `recover` reads a hidden code from stdin or a private input
  file. The code is not accepted as a command-line value.
- The trusted local operator supports issuing and importing codes on either
  platform without granting room users installation-wide privileges.
- Synchronize new copy and instructions in Russian, English and Chinese.

## Proof required

Reproduce an old source peer plus a fresh destination data directory with a
new UUID/CA. Issue, prepare, save reverse, commit, reload both stores and prove
the retained pair ID and scope now point to the new installation. Exercise
lost responses, concurrent claim/commit/profile writes, revoked/expired codes,
changed creator rights, wrong origin/UUID/CA, active reserve/transfer blocking,
malformed input, and attempts to change other peers or gain installation scope.
Run focused platform fixtures, TypeScript and the repository CI suite.
