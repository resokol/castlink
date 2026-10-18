[Русский](../../LINUX_INSTALL.md) · **English** · [简体中文](../zh-CN/LINUX_INSTALL.md)

# CastLink: install on Linux without Windows or a graphical wizard

The new device checks, roles, and private replies require an updated room server. See the [changelog](CHANGELOG.md); the commands below still install the pinned earlier release.

The manual Linux guide remains pinned to the earlier `easy-setup-8b02e2d4dc3c` release: do not replace its tag or checksums with `latest`. To migrate a VPS to the new Easy Setup layout, use the new Windows wizard over SSH. The commands below install the pinned build, not the latest release with multiview.

Guide for the published test release [`easy-setup-8b02e2d4dc3c`](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-8b02e2d4dc3c). The server is deployed from prebuilt images; Git, Node.js, building the application, and Windows are not required. **Docker Engine and Docker Compose are required on the VPS.** Casters' devices only need a browser.

The steps below use the internal `server-provision-vps.py`, included in the ready-to-use server image. This is not an interactive installer: it accepts one JSON object on standard input. This helper has no separate `castlink install` executable or `--domain` flags. The Linux archive contains images and a Docker preparation script; running that preparation script alone does not install CastLink.

## 1. Prepare a dedicated VPS

- Ubuntu **22.04 or 24.04**, **amd64/x86_64** architecture, a public static IPv4 address, and root access over SSH.
- For an initial test, **2 vCPU, 4 GB RAM, and at least 20 GB free disk space** are recommended. This allows room for startup, images, and backups; it does not promise a particular capacity. A separate profile with 2 GB RAM and swap has been tested; this is not a guaranteed minimum under broadcast load. Test the number of casters, video quality, and bandwidth with your own load.
- The ports in the table below must be available and allowed in the provider panel and server firewall. Do not use them for another web server.
- Outbound HTTPS access to GitHub and its file download servers, Ubuntu/Docker repositories, and the Let's Encrypt ACME service. The system clock must be correct.

| Purpose | Inbound ports |
| --- | --- |
| SSH management | TCP 22 or your configured SSH port |
| HTTPS and certificate issuance | TCP 443 and TCP 80 |
| LiveKit media connections | TCP 7881, UDP 7882 |
| TURN/UDP | UDP 3478 and UDP 30000–30031 |

These ports are specific to the Python helper configuration in this release. TCP 3000, TCP 5432, and TCP 7880 are not exposed externally. This method does not configure TURN over TLS/TCP 443; media connectivity in networks that block UDP requires separate testing. Docker rules and the provider firewall also affect port reachability.

Run all the following commands **on the VPS**, in a single root Bash session. Here, `203.0.113.10` is an example: replace it with your public IPv4 address. On the first SSH connection, compare the server key fingerprint with your provider's information.

```bash
ssh root@203.0.113.10
```

Start with a check that refuses to continue if it finds a previous installation directory, including a stopped installation. For an existing server, go to the update section after checking its configuration; do not run a new installation over existing data.

```bash
set -euo pipefail
umask 077
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
test "$(id -u)" = 0
. /etc/os-release
test "$ID" = ubuntu
case "$VERSION_ID" in 22.04|24.04) ;; *) exit 1 ;; esac
test "$(uname -m)" = x86_64
if compgen -G '/opt/castlink-easy-*' >/dev/null; then
  echo 'Обнаружена прежняя установка. Остановитесь и проверьте её данные.' >&2
  exit 1
fi
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3
WORK_DIR=$(mktemp -d /root/castlink-install.XXXXXXXX)
cd "$WORK_DIR"
```

Save the path shown by `pwd`: this folder will retain the verified package, helper, and installation request.

```bash
pwd
```

## 2. Download one fixed release and verify SHA-256

```bash
RELEASE_TAG=easy-setup-8b02e2d4dc3c
RELEASE_BASE="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
for FILE in CastLink-Linux.tar.gz CastLink-Provisioning.json SHA256SUMS; do
  curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --retry 3 "$RELEASE_BASE/$FILE" -o "$FILE"
done
sha256sum --check <<'SUMS'
95e39918de48685ee5c86f434f53e5f5be54d2d9f21923e659189a7b5438d6a3  CastLink-Linux.tar.gz
d544a92d48772a3267539f2161a509fb0cc57ec1136dec7fefd85562ba38088c  CastLink-Provisioning.json
1c8cc067ed5165f691278f3a4be5250017569a5e8dc5a54db7f7f56c172a0d88  SHA256SUMS
SUMS
sha256sum --check --ignore-missing SHA256SUMS
mkdir bundle
tar -xzf CastLink-Linux.tar.gz -C bundle
```

Continue only if the checks finish without errors and show `OK`. The listed checksums apply only to the specified release; do not use them with another tag. SHA-256 verification detects corruption or substitution relative to the expected checksum; the checksum file is not a separate digital signature.

Verify the version and the internal image archive:

```bash
python3 - <<'PY'
import hashlib, json
from pathlib import Path
r = json.loads(Path('bundle/payload/release.json').read_text())
p = json.loads(Path('CastLink-Provisioning.json').read_text())
assert r['commit'] == p['commit'] == '8b02e2d4dc3c286f2a5b6ace5859fbb645bae677'
assert r['distributionRepository'] == 'resokol/castlink-releases'
digest = hashlib.sha256()
with Path('bundle/payload/images.tar.gz').open('rb') as f:
    for block in iter(lambda: f.read(1024 * 1024), b''):
        digest.update(block)
assert digest.hexdigest() == r['imageArchiveSha256']
print('Образы проверены:', r['version'], r['commit'][:12])
PY
```

## 3. Prepare Docker and extract the internal helper

The command below runs only Linux environment preparation from the verified package. It installs Docker Engine/Compose if missing, starts Docker if stopped, and prepares the `/opt/castlink` directory. Compose **2.23.1 or later** is required. This does not launch the Windows wizard or deploy the application yet.

```bash
bash bundle/scripts/ubuntu-easy-setup-bootstrap.sh install
docker --host unix:///var/run/docker.sock info --format '{{.OSType}}'
docker compose version
docker --host unix:///var/run/docker.sock load --input bundle/payload/images.tar.gz
WEB_IMAGE=$(python3 -c 'import json; print(json.load(open("bundle/payload/release.json"))["images"]["web"])')
TEMP_CONTAINER=$(docker --host unix:///var/run/docker.sock create \
  --network none --entrypoint /bin/true "$WEB_IMAGE")
docker --host unix:///var/run/docker.sock cp \
  "$TEMP_CONTAINER:/app/scripts/server-provision-vps.py" ./server-provision-vps.py
docker --host unix:///var/run/docker.sock rm "$TEMP_CONTAINER"
chmod 600 server-provision-vps.py
```

The temporary container is not started: it is only used to copy the internal file from the published image. The application is not built from source. These commands do not remove other containers or volumes.

## 4. Install CastLink using a public IPv4 address

Replace the IP in the next block. The `host` field requires an **IPv4 address**, without `https://`, a port, or a path. Do not substitute a domain such as `example.org` here: this helper builds the media configuration directly from the IPv4 address and has no separate domain parameter.

```bash
python3 - <<'PY'
import hashlib, ipaddress, json
from pathlib import Path
host = '203.0.113.10'  # Замените своим публичным IPv4.
ipaddress.IPv4Address(host)
r = json.loads(Path('bundle/payload/release.json').read_text())
digest = hashlib.sha256()
with Path('CastLink-Linux.tar.gz').open('rb') as f:
    for block in iter(lambda: f.read(1024 * 1024), b''):
        digest.update(block)
request = {
    'action': 'deploy', 'host': host,
    'releaseUrl': 'https://github.com/resokol/castlink-releases/releases/download/easy-setup-8b02e2d4dc3c/CastLink-Linux.tar.gz',
    'releaseSha256': digest.hexdigest(),
    'releaseCommit': r['commit'], 'releaseCommitPrefix': r['commit'][:12],
}
Path('install-request.json').write_text(json.dumps(request))
PY
python3 server-provision-vps.py < install-request.json | tee install-events.jsonl
```

The helper downloads and verifies the Linux archive again, loads the images, creates random secrets and a separate installation, starts services, prepares the database, and completes initial setup. This additional download is expected. JSON lines show the stages; successful completion includes a `result` object with `installationId`. An error or a nonzero exit code means the installation needs checking.

Save the installation path in a variable and a small private file so you can use it after logging in over SSH again:

```bash
INSTALL_DIR=$(python3 - <<'PY'
import json, uuid
from pathlib import Path
results = [v['result'] for line in Path('install-events.jsonl').read_text().splitlines()
           if isinstance((v := json.loads(line)).get('result'), dict)]
assert len(results) == 1
iid = uuid.UUID(results[0]['installationId'])
print('/opt/castlink-easy-' + iid.hex)
PY
)
printf '%s\n' "$INSTALL_DIR" > installation-path.txt
printf 'Каталог установки: %s\n' "$INSTALL_DIR"
```

Do not publish the contents of `web.env`, `postgres.env`, `.castlink-install.json`, or backups: they contain secrets and installation data.

## 5. Verify HTTPS and media connectivity

Four services run in this installation: `web`, `postgres`, `livekit`, and `caddy`. A fifth TURN TLS image may be present in the package, but this method does not start it. Docker uses the `unless-stopped` policy.

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" ps --all
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" logs --tail 100 caddy
curl --fail --show-error https://203.0.113.10/api/version
```

Here and below, replace the example IP with your address. The expected `buildId` is `1.0.0-rc.2-8b02e2d4dc3c`. Also run the last command from another computer outside the VPS network. Do not add `-k`: a trusted certificate must be verified.

Caddy is configured to request and renew a public Let's Encrypt certificate for the IP using the `shortlived` ACME profile. A domain is optional for this setup. Certificate issuance depends on external VPS reachability and the ACME service. Completion of the Python helper confirms internal application readiness, **but does not by itself confirm external HTTPS or media transmission**. If the certificate has not been issued yet, check the Caddy log, TCP 80/443 reachability, the clock, and certificate issuance limits; do not disable TLS verification.

Open `https://203.0.113.10/` in an up-to-date browser. Create a test room, check camera/microphone permissions, connect a caster from another network, and watch the studio broadcast. Check audio using headphones. A successful HTTP response does not replace video and audio testing.

## 6. Status, logs, stopping, and starting

After a new SSH login, return to the saved working folder and restore the variable:

```bash
INSTALL_DIR=$(cat installation-path.txt)
test -f "$INSTALL_DIR/compose.json"
```

Status and recent messages:

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" ps --all
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" logs --tail 100
docker --host unix:///var/run/docker.sock stats --no-stream
df -h /opt /var/lib/docker
```

Stop and then start only this installation:

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" stop
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" up -d --pull never --no-build
```

Run these two commands separately when needed. Stopping interrupts the broadcast but preserves data. After a manual `stop`, the `unless-stopped` policy does not necessarily start the services on reboot: use the start command above.

Configuration is stored in `$INSTALL_DIR`: `compose.json`, `web.env`, `postgres.env`, `livekit.json`, `Caddyfile`, and `.castlink-install.json`. Persistent data is stored in this installation's Docker volumes: `postgres-data`, `web-data`, `caddy-data`, and `caddy-config`; Docker names have the project prefix. They retain the database, application data, and certificates. Save both the configuration with secrets and consistent data backups. Simply copying a running PostgreSQL volume is not a consistent backup.

Do not run `docker compose down -v`, a global `docker system prune --volumes`, or delete the installation directory to restart/update. Do not move `compose.json` alone: it references the other files and data.

## 7. Update an existing installation

The command below updates only web. It does not apply the new Easy Setup port layout or recreate LiveKit. To migrate from the wide UDP ranges, use the new installer and first allow UDP 7882 in external firewalls and on your router.

Running `deploy` again is not an update. For an installation in this format, the helper supports a separate JSON object with `action: update`. It changes only the `web` image, preserving the UUID, profiles, settings, infrastructure containers, and volumes. This is not a mechanism for updating Docker, PostgreSQL, LiveKit, or Caddy.

Schedule a maintenance window and end all sessions: the helper refuses to update a server with participants or when it cannot verify that no participants are present. Before replacement, it checks free space and SQL compatibility, backs up configuration, PostgreSQL, and `web-data` to `$INSTALL_DIR/backups/`, blocks writes during the work, and checks HTTPS. Rollback is provided for errors before writes are reopened; if rollback fails, the backup remains available for recovery. A refusal due to migrations requires separate instructions for the relevant release.

The following example selects the same release and should return `outcome: current` on a server installed using this guide. For an actual update, replace `UPDATE_TAG` with a **specific published tag** and first read its notes and requirements. Do not mix files from different releases. Run from the saved working folder with `INSTALL_DIR` set.

```bash
UPDATE_TAG=easy-setup-8b02e2d4dc3c
UPDATE_BASE="https://github.com/resokol/castlink-releases/releases/download/$UPDATE_TAG"
UPDATE_DIR=$(mktemp -d "$PWD/update.XXXXXXXX")
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  "$UPDATE_BASE/SHA256SUMS" -o "$UPDATE_DIR/SHA256SUMS"
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  "$UPDATE_BASE/CastLink-Provisioning.json" -o "$UPDATE_DIR/CastLink-Provisioning.json"
export UPDATE_TAG UPDATE_DIR INSTALL_DIR
python3 - <<'PY'
import hashlib, ipaddress, json, os, re
from pathlib import Path
tag = os.environ['UPDATE_TAG']
assert re.fullmatch(r'easy-setup-[a-f0-9]{12}', tag)
folder = Path(os.environ['UPDATE_DIR'])
checksums = {}
for line in (folder / 'SHA256SUMS').read_text().splitlines():
    digest, name = line.split()
    assert re.fullmatch(r'[a-f0-9]{64}', digest)
    assert name not in checksums
    checksums[name] = digest
metadata = (folder / 'CastLink-Provisioning.json').read_bytes()
assert hashlib.sha256(metadata).hexdigest() == checksums['CastLink-Provisioning.json']
r = json.loads(metadata)
assert re.fullmatch(r'[a-f0-9]{40}', r['commit'])
assert r['commit'].startswith(tag.removeprefix('easy-setup-'))
assert 'vps-update-maintenance-v1' in r['capabilities']
state = json.loads((Path(os.environ['INSTALL_DIR']) / '.castlink-install.json').read_text())
host = str(ipaddress.IPv4Address(state['address']))
assert state['completed'] is True
request = {
    'action': 'update', 'installationId': state['installationId'],
    'host': host, 'origin': 'https://' + host,
    'releaseUrl': 'https://github.com/resokol/castlink-releases/releases/download/' + tag + '/CastLink-Linux.tar.gz',
    'releaseSha256': checksums['CastLink-Linux.tar.gz'],
    'releaseCommit': r['commit'], 'releaseCommitPrefix': r['commit'][:12],
}
(folder / 'update-request.json').write_text(json.dumps(request))
PY
python3 server-provision-vps.py < "$UPDATE_DIR/update-request.json" \
  | tee "$UPDATE_DIR/update-events.jsonl"
curl --fail --show-error https://203.0.113.10/api/version
```

In this example, the new release checksums are retrieved over HTTPS from its public `SHA256SUMS`; if an expected checksum is published separately, compare it as well. The final result must include `outcome: updated` or `current` and the expected `buildId`. After updating, repeat the external HTTPS and media tests. For a server whose address/configuration has been changed manually, first check that this procedure applies.

## If installation is interrupted

Keep the working folder, `$INSTALL_DIR`, Docker volumes, and error messages. The helper can resume an unfinished installation by running **the same** `install-request.json` again, with the same IP, release, and unchanged files. Do not repeat the initial block for a new installation: its check deliberately stops when an existing directory is present. Use start/stop commands or `update` to maintain a completed installation.

If ports are occupied, the helper refuses to continue. Do not automatically stop unrelated services. If there are UUID, release, configuration, or secret mismatch errors, stop and investigate the state; deleting verification files does not fix the data.

## Scope of this guide

This procedure covers a dedicated Ubuntu VPS with a public IPv4 address and the published release helper's standard configuration. Access through a domain such as `example.org`, separate TURN TLS, IPv6, NAT/CGNAT, and migration of existing data require separate configuration; adding a DNS record alone does not change the certificate or installation address. Untested features in development do not apply to this release.

The commands have been checked against the release packaging and utilities. A complete installation following this guide on a clean VPS and a real broadcast were not performed while preparing this document; external certificate issuance and connection quality must be checked on your server.


---

[Set up TURN/TLS on TCP 443](TURN_TLS.md)
