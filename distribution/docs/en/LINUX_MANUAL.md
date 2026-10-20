# Install CastLink manually on Linux

[Русский](../../LINUX_MANUAL.md) · [English](LINUX_MANUAL.md) · [简体中文](../zh-CN/LINUX_MANUAL.md)

Choose [Out of the box](#out-of-box) or [Advanced](#advanced) from an SSH terminal. No Windows wizard is needed. This guide uses the official package advertising `network-modes-v1` and `linux-compose-v1`; new documentation does not add features to an older package. [Installation overview](INSTALL.md) · [User guide](../../README.md) · [Releases](https://github.com/resokol/castlink-releases/releases).

## Prepare the host and verify the package

Requirements: Ubuntu 22.04/24.04 x86_64 (amd64), Python 3.8+, a working Docker Engine running Linux containers, Docker Compose **2.23.1 or later**, `curl`, `tar` and `sha256sum`. Other distributions have not been separately verified. Connect to your server over SSH and run the examples in an administrative shell (`sudo -i` if necessary). Docker access grants administrative power. Use the same Docker Engine and data directory throughout; do not switch Docker contexts between commands.

Install prerequisites using Ubuntu's instructions and [Docker Engine for Ubuntu](https://docs.docker.com/engine/install/ubuntu/). This Linux CLI does not install the OS, Python or Docker. Preserve SSH access and your working connection. Check without changing services:

```bash
uname -m
python3 --version
docker info --format '{{.OSType}}'
docker compose version
```

Expect `x86_64`, Python 3.8+, `linux` and a suitable Compose version. Allow free ports and disk space for images, the database and backups. 20 GB free is an initial test guideline, not a measured minimum.

Select **one** release. The example pins the existing `easy-setup-1472cd052d7e`. To select another, change `RELEASE_TAG`, download all files from that same release and check its capabilities. Do not mix an archive and checksums from different tags. Extract each release into a new folder, separate from persistent data:

```bash
set -euo pipefail
umask 077
RELEASE_TAG='easy-setup-1472cd052d7e'
mkdir -p /opt/castlink-releases
cd /opt/castlink-releases
mkdir "$RELEASE_TAG"
cd "$RELEASE_TAG"
RELEASE_URL="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
curl --fail --location --proto '=https' "$RELEASE_URL/CastLink-Linux.tar.gz" -o CastLink-Linux.tar.gz
curl --fail --location --proto '=https' "$RELEASE_URL/SHA256SUMS" -o SHA256SUMS
sha256sum --check --ignore-missing SHA256SUMS
tar --extract --gzip --file CastLink-Linux.tar.gz
python3 -c 'import json; r=json.load(open("payload/release.json")); assert {"network-modes-v1","linux-compose-v1"} <= set(r.get("capabilities", [])); print(r["commit"])'
python3 scripts/linux-compose-setup.py --help
CASTLINK_STATE=/opt/castlink-manual
```

Continue only after `CastLink-Linux.tar.gz: OK` and a successful capability check. The example intentionally stops if `mkdir` finds an existing release folder; never extract a new release over an old one. The CLI also verifies package files and the image archive against `payload/release.json`. Images are included: building the app or pulling its images from Docker Hub is unnecessary.

The persistent `/opt/castlink-manual` directory must be new and private. `init` creates it with mode 0700 and configuration/secret files with mode 0600; `umask 077` also protects files created by the operator. Do not point it at a Windows-wizard installation. The CLI refuses that state and does not migrate it.

<a id="out-of-box"></a>
## Out of the box: HTTPS and standard ports

Use this for a dedicated public VPS or LAN server. For a VPS, point the domain's A record at the public server IPv4, or use that public IPv4 directly. The CLI does not configure DNS or NAT. For LAN use an address reachable by client devices.

```bash
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --lang en
```

Answer the prompts:

| Prompt | Public VPS | Local network |
| --- | --- | --- |
| Setup mode | `quick` | `quick` |
| Public origin | `https://meet.example.com`, or HTTPS with your public IPv4 | For example, `https://192.168.1.50` |
| Server media IPv4 | Public IPv4 reachable by clients | Server LAN IPv4 |
| Public HTTPS certificate? | `yes` | `no` — private CA |

Replace examples with your addresses. Default `127.0.0.1` values are reachable only on the server; do not keep them for remote clients. Quick mode uses HTTPS, HTTP/HTTPS 80/443, media TCP 7881, media UDP 7882, TURN UDP 3478 and relay UDP 30000–30031. Caddy binds to `0.0.0.0` unless the media IPv4 is loopback.

For a noninteractive equivalent using an **example LAN address**, save this as `quick.json`, replace the IP and validate:

```json
{
  "setupMode": "quick",
  "publicHttps": false,
  "network": {
    "mode": "https",
    "publicOrigin": "https://192.168.1.50",
    "bindAddress": "0.0.0.0",
    "httpPort": 80,
    "httpsPort": 443,
    "mediaIp": "192.168.1.50",
    "iceTcpPort": 7881,
    "iceUdpPort": 7882,
    "turnUdpPort": 3478,
    "relayPortStart": 30000,
    "relayPortEnd": 30031,
    "trustedProxies": []
  }
}
```

```bash
python3 scripts/linux-compose-setup.py validate --config quick.json --lang en
# Instead of interactive init, for a new installation only:
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --config quick.json --lang en
```

`init` prepares configuration and generates service secrets. Its “Ready” message does not mean the server is running. The CLI does not request or print a room or studio password. Start services:

```bash
python3 scripts/linux-compose-setup.py start --state-dir "$CASTLINK_STATE" --lang en
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang en
```

`start` loads images, starts Compose, runs database migrations/initialization and configures the site. For direct HTTPS it verifies Caddy and the expected version with certificate validation. `status` reports saved `completed`, `readiness`, commit and current container state; a saved success does not replace a current site check.

With `publicHttps: true`, Caddy obtains a public certificate. Correct DNS/public addressing and reachable ACME ports are required; the standard layout uses TCP 80/443. With `false`, it uses a private CA. The CLI **does not install trust on client devices** or create the Windows trust kit. After a successful `start`, export only the public root certificate:

```bash
docker compose -f "$CASTLINK_STATE/compose.json" exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > "$CASTLINK_STATE/castlink-root-ca.crt"
```

Verify the certificate's origin on your server, then install it in the trusted roots of each client device according to its OS/browser instructions. Share only `castlink-root-ca.crt`, never the directory containing secrets. To check from the server: `curl --fail --cacert "$CASTLINK_STATE/castlink-root-ca.crt" https://192.168.1.50/api/version`; replace the address. Clicking through a browser warning does not install CA trust.

<a id="advanced"></a>
## Advanced: custom ports, HTTP or an external HTTPS proxy

Run the same `init` and choose `advanced`. It additionally asks for `https/http/proxy`, Caddy bind IPv4, all ports and, for proxy mode, trusted IPv4/CIDRs. Alternatively pass a complete JSON file with `--config`. This is the Linux flag; Windows `-NetworkConfigPath` does not apply.

Example `advanced.json` for an HTTPS proxy on the **same host**, forwarding HTTP to CastLink's internal Caddy:

```json
{
  "setupMode": "advanced",
  "publicHttps": false,
  "network": {
    "mode": "proxy",
    "publicOrigin": "https://meet.example.com",
    "bindAddress": "127.0.0.1",
    "httpPort": 8080,
    "httpsPort": 443,
    "mediaIp": "203.0.113.8",
    "iceTcpPort": 7881,
    "iceUdpPort": 7882,
    "turnUdpPort": 3478,
    "relayPortStart": 30000,
    "relayPortEnd": 30031,
    "trustedProxies": ["172.17.0.1/32"]
  }
}
```

The domain, `203.0.113.8` and `172.17.0.1/32` are examples, not working settings for your server. `trustedProxies` identifies the connecting proxy address **as seen by Caddy inside Docker**, not the browser address. Docker NAT may replace localhost with a gateway address. Determine the actual address/subnet for your route; do not copy this value blindly. Trusting `0.0.0.0/0` is forbidden. For a proxy on another machine/in a container, select a reachable private `bindAddress` and restrict HTTP-listener access to that proxy.

```bash
python3 scripts/linux-compose-setup.py validate --config advanced.json --lang en
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --config advanced.json --lang en
python3 scripts/linux-compose-setup.py start --state-dir "$CASTLINK_STATE" --lang en
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang en
```

Use this `init` instead of the quick version for a new installation. Repeating `init` preserves existing settings; it does not change a running installation to a new JSON configuration.

| Field | Meaning |
| --- | --- |
| `setupMode` | `quick` or `advanced`; JSON still requires all network fields |
| `publicHttps` | JSON boolean: public certificate for direct HTTPS, or private CA when `false`; use `false` for proxy/http |
| `network.mode` | `https`: Caddy terminates TLS; `http`: no TLS; `proxy`: an external proxy terminates TLS |
| `publicOrigin` | Full external origin without a path or credentials, e.g. `https://meet.example.com:8443` |
| `bindAddress` | Website listening IPv4 on the Docker host; does not select the media bind address |
| `mediaIp` | Specific server IPv4 reachable by clients, not a domain or `0.0.0.0` |
| `httpPort / httpsPort` | Integers 1–65535. Direct-mode origin must match the corresponding published port; proxy mode may have a different external port |
| `iceTcpPort / iceUdpPort / turnUdpPort` | Media TCP / media UDP / TURN UDP; defaults 7881 / 7882 / 3478 |
| `relayPortStart / relayPortEnd` | Inclusive UDP relay range, 1–1024 ports; default 30000–30031 |
| `trustedProxies` | IPv4/CIDR array; nonempty for `proxy`, otherwise `[]` |

Avoid same-protocol port collisions. Open selected ports in the firewall, provider panel and NAT, preserving port numbers. For direct public HTTPS with a custom HTTP port, ACME HTTP-01 needs external TCP 80 forwarded to that port; an arbitrary port alone does not enable certificate issuance. HTTP outside localhost usually blocks browser camera, microphone and screen sharing.

The external proxy needs a valid certificate and must forward every path, including `/rtc`, WebSocket Upgrade, Host and verified forwarded headers. See [Nginx/Caddy examples in INSTALL.md](INSTALL.md#behind-an-external-proxy). CastLink Caddy retains media-admission checks. A website proxy does not replace media ports. This standalone CLI configures TURN/UDP; it does not automatically add TURN/TLS 443. PostgreSQL and web:3000 are not published publicly.

In `proxy` mode a successful `start` means `readiness: local-ingress-only`: internal HTTP was checked, external HTTPS was not. From another device check `https://meet.example.com/api/version`, room entry, real camera/microphone/screen sharing and receipt of audio/video in the target browser or OBS/vMix. Direct HTTPS also needs a separate external-route and media check.

## Diagnose, back up and update

In a new SSH session, set `CASTLINK_STATE=/opt/castlink-manual` again and enter the appropriate extracted release folder. Inspect only this installation first:

```bash
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang en
docker compose -f "$CASTLINK_STATE/compose.json" config --quiet
docker compose -f "$CASTLINK_STATE/compose.json" ps
docker compose -f "$CASTLINK_STATE/compose.json" logs --tail 100
```

For network failures check DNS, firewall, port conflicts, media IP, certificate trust and the proxy route. Do not publish env/state/secrets, invitations or raw logs. `render` rewrites generated configuration from saved state; manual edits to those files may be lost.

End broadcasts before updating: services restart. Verify the new package in a separate release folder using the same procedure. Keep the old release folder for diagnosis. From the **new** package, using the **same** persistent directory:

```bash
python3 scripts/linux-compose-setup.py backup --state-dir "$CASTLINK_STATE" --lang en
python3 scripts/linux-compose-setup.py update --state-dir "$CASTLINK_STATE" --lang en
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang en
```

`backup` creates a private folder under `backups/` containing configuration/state/secrets, `postgres.dump`, `web-data.tar` and checksums. It briefly pauses web for consistency and resumes it even if copying fails. Caddy volumes holding the CA/certificates are not included; back those up separately using your Docker recovery procedure. Keep a verified protected copy off the server.

`update` takes an additional such backup before changing images and retains UUIDs, secrets, network settings and volume names. There is no automatic database/data rollback. On failure preserve the directory and volumes; after fixing the cause, `start` from the selected new package completes that installation. For a different commit, ordinary `start` requires `update` first; finish an incomplete previous installation with its own package first. Do not run `init` in a new data directory to update. Do not use `down -v` or blind `docker system prune`: they can destroy persistent data or affect other projects.
