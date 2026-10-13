# Opt-in diagnostic browser runtime source

This Linux amd64 helper has a measured build and private loopback image pin in
the owned cloud proof environment. `runtime-contract.json` records its manifest,
image ID, binaries, and exact build-source hashes. The compiled target pin uses
that immutable reference; caller image names, manifests, and matching labels
cannot grant provenance. Independent source pin review and full guarded media
acceptance remain pending. Availability on other hosts is unverified; this is
not a public or portable release artifact. The four installed CastLink services
remain unchanged.

The base digest was read from the local Debian trixie cache; local image ID was
`sha256:ec92d6b34c6a7e6372d87dc9ef2fd6e8ca8125353fe7d033c676f51cf923a13b`.
The Node 22.23.3 amd64 binary SHA was measured from the approved toolchain. Before
building, stage that exact binary as untracked `node` and its original bundled
LICENSE as `node-LICENSE`. Do not download a replacement or change the Node pin
to make a build pass. The old Chromium 151 package was absent from live official
repositories; the reviewed build uses security Chromium/common
154.0.8037.92-1~deb13u1 and NSS tools 2:3.110-1+deb13u4. This new Chrome 154 proof
does not relabel earlier Chrome 151 fixture evidence.
Package notices in `/usr/share/doc` and Node's original LICENSE remain in the
image; the built package inventory records actual transitive software versions.
No other architecture or reproducible dependency resolution is claimed.

Build only in the authorized serial resource window. Mount the provided public build
CA through BuildKit `--secret id=proxy_ca,src=<configured CA path>`; never copy
proxy credentials or session trust into a layer. HTTPS verification stays on.
The mount uses mode 0444 for apt's `_apt` reader. Inspect and retain actual image
ID, digest, architecture, source hash, binary hashes, package versions and
licenses before filling a compiled runtime pin. The image embeds the pre-pin
contract with null digest; the external contract records its build hash rather
than rebuilding to create a self-referential digest.

The guarded launcher must create an exact owned diagnostic container under the
canonical media target lease, with frozen engine and verified Caddy ID/image/
network. Use no host network, public ports, extra capabilities, Docker socket,
host HOME/NSS or broad host /usr mounts. Container-private CA preparation needs guarded PRE/effect/POST. Chromium
launch, every profile/cookie write, and exact-container reap share ONE held
canonical operation through original-snapshot POST and terminal epoch ACK.
Ready metadata never advances the cursor or certifies evidence. Lost
acknowledgements retain unknown authority without name-based adoption. Guest links travel through
private process pipes only. Remote host export is not implemented.

Synthetic headless camera/microphone/screen operation explicitly disables the
Chromium sandbox inside the isolated container. It cannot certify physical
devices or native Chromium sandbox support. It must never be an implicit native
fallback. Native host namespace/NSS isolation is currently unverified. Actual
CastLink two-guest UI/getStats, relay and outbound independence proof are pending.

The browser accepts only the opaque authority minted by the actual guarded
media transport from its original successful room and invitation ACKs. Caller
JSON, current-file ledgers, replacement associations and callbacks cannot mint
that authority. Run/room/guest/ledger inode and content associations remain bound
to the original receipt. Internally collected evidence becomes eligible only
after successful browser close, owned-container reap and terminal ACK; imported
copies remain unverified. Protocol process fixtures exercise these boundaries,
but do not prove Chromium media or physical devices. Actual image proof now
confirms private NSS preparation, fixed PID1 idle/invalid-action handling,
private CDP Browser.getVersion and clean Browser.close, exact owned-container
kill, the 110-second Chrome lifetime, empty/redacted logs, and exact-CID reap.
It does not exercise the original guarded SQL/room/guest target transport.

Runtime deadlines bound the Chromium process group and ephemeral container
lifetime. All three actual proof containers were removed and proved absent.
An interrupted guarded operation remains UNKNOWN; helper-only runtime proof
does not certify its target cursor, terminal authority ACK, or media evidence.
