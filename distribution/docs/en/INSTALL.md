# CastLink installation: quick and advanced

[Русский](../../INSTALL.md) · [English](INSTALL.md) · [简体中文](../zh-CN/INSTALL.md)

This guide applies to packages advertising `network-modes-v1` and `linux-compose-v1`. Updating documentation does not add these features to older packages.


## Updates and disk usage: new release

The following behavior requires new packages with `public-updates-v1` and `production-retention-v1`; replace older published installers with the new package first.

The Windows client checks client releases and saved managed servers separately. On startup it offers a newer version with Update / Stay on current version. Disable automatic update checks is saved; manual checking remains in the menu. A normal connection URL does not grant permission to update that server. Updating a managed VPS opens the wizard and requests SSH access when needed.

Downloads are checked against SHA256 from the selected published release. Installing the client requires a separate confirmation to close the application. Server updates require an explicit user action through the wizard.

End-user servers create no automatic backups. Once the new server passes readiness checks, obsolete unused images owned by the installation and its temporary archives are cleaned. Data, foreign images and images used by other containers, including stopped containers, remain. Failed updates retain the old images. One current image set means one current image for each server service; the server has multiple services.

Linux CLI: `check-updates`, `update`, `updates --auto-check off` and `updates --auto-check on`. See the [Linux manual](LINUX_MANUAL.md) for commands and failure behavior.

## Package selection and normal installation

[Three packages and separate downloads](PRODUCTS.md): **Client** joins a server, **Server Setup** installs a server on a PC/VPS from Windows, and **Linux** installs it without the Windows wizard. The current published version is **1.0.0-rc.8** (Server Setup `380c06fe0ee1`; Client/Linux `bdfe91a92b6b`); select the package and checksums for its track. Products update independently; 1.1 is deferred.

Normal installation uses standard settings. Technical choices require explicitly selecting advanced mode. The Windows client uses a multipage installer for the current user with an installation-directory choice. Server Setup makes advanced settings optional; SSH uses the saved port or 22. Linux `init` defaults to quick mode; add `--advanced` for technical options. The site address determines HTTPS and media IPv4; another IPv4 is requested only for missing or ambiguous DNS. Updates preserve existing settings.

## Reinstalling and removing

If the wizard offers to continue an unfinished installation, choose “No” to select a new folder and address. A new local installation requires a LAN or public IPv4; an obsolete test draft using 127.0.0.1 is no longer selected automatically. Successful removal clears continuation for that installation. If data was retained, reinstall into the same folder to restore it.

To remove a remote server, choose “Remove server” → “Remote server”. The wizard connects over SSH and lists installations on the VPS; it does not require a local wizard folder. Download the new Windows Server Setup and extract it into a separate folder; the old EXE does not update itself.

## Windows

Extract the complete `CastLink-Windows.zip`, open `EasySetup.exe`, select installation; quick mode is the default and advanced settings are optional:

- **Quick (recommended)** — HTTPS, standard ports, generated secrets and database setup. Select the target and address. Local installations use a private certificate and a portable trust kit; VPS installations use a public certificate. Reserve servers can be added later.
- **Advanced** — direct HTTPS, HTTP or an external HTTPS proxy; public site URL, listening IPv4, site ports, trusted proxies, separate media IPv4, media TCP/UDP and TURN relay range. JSON configuration is also accepted through `-NetworkConfigPath`.

The language buttons switch Russian, English and Simplified Chinese without resetting inputs. When updating, select the existing installation: network settings, UUIDs, secrets and volumes are retained. Updating does not automatically change its network layout.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-simple-easy-setup.ps1 -SetupMode advanced -NetworkConfigPath network.json
```

## Linux without the Windows wizard

Dedicated SSH-terminal guide: [Out of the box](LINUX_MANUAL.md#out-of-box) · [Advanced](LINUX_MANUAL.md#advanced), including package verification, JSON, certificates and updates.

Requirements: Linux amd64, Python 3.8+, Docker and Docker Compose v2. Verify the official `CastLink-Linux.tar.gz` against `SHA256SUMS`. Extract each release into a separate directory. The helper verifies packaged files against the manifest and loads the included images; Docker Hub and private GitHub access are unnecessary for images.

From the extracted package:

```bash
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --lang en
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang en
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang en
```

Use `ru` or `zh-CN` for other languages. `init` defaults to quick mode and writes configuration (`--advanced` opts in to advanced mode); `start` loads images, starts services and initializes the database. Local HTTPS requires trusting the generated CA on client devices. Public HTTPS requires working DNS/public IP and reachable ACME ports. Verify real audio/video with a separate connection.

The persistent `/opt/castlink-manual` directory contains `compose.json`, `Caddyfile`, `livekit.json`, env files and private state/secrets. Do not publish it. Keep it separate from extracted releases and back it up. The Linux helper and Windows wizard manage their own installations; the helper refuses to adopt Windows-wizard installations.

## Behind an external proxy

```text
Browser → HTTPS → Nginx/Caddy → HTTP → CastLink Caddy → application
Media → separate LiveKit/TURN ports
```

Example `network.json` for a proxy on the same host:

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

Replace the domain, mediaIp and trustedProxies. `203.0.113.8` is a documentation address. Trusted proxies must match the source address **seen by Caddy inside Docker**, not the browser address. Docker can replace localhost with its gateway address; verify your actual address/subnet. `0.0.0.0/0` is rejected. For another machine/container, choose a reachable private `bindAddress` and restrict access to that proxy.

```bash
python3 scripts/linux-compose-setup.py validate --config network.json --lang en
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --config network.json --lang en
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang en
```

External Caddy on the same host:

```caddyfile
meet.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

External Nginx example; replace certificate paths:

```nginx
server {
    listen 443 ssl;
    server_name meet.example.com;
    ssl_certificate /etc/ssl/meet/fullchain.pem;
    ssl_certificate_key /etc/ssl/meet/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

Forward all paths, including `/rtc` and WebSocket. Internal Caddy retains `/api/media-admission`, removes spoofed forwarding headers from untrusted sources and passes the validated client IP to the application. Internal HTTP readiness does not prove external HTTPS readiness: check `https://meet.example.com/api/version` and join a room from another device.

## HTTP, HTTPS and ports

Plain HTTP outside localhost restricts browser camera, microphone and screen sharing. Use HTTPS or an external HTTPS proxy for LAN/internet users. Private-CA HTTPS can work on a LAN, but accepting a browser warning does not install CA trust.

Direct public HTTPS normally uses TCP 80/443. A custom published HTTP port requires forwarding external TCP 80 to that port for ACME HTTP-01; an arbitrary port alone does not enable certificate issuance. The `publicOrigin` port must match direct HTTP/HTTPS configuration. Proxy mode separates the external port from the internal HTTP port.

Default media ports: TCP 7881, UDP 7882, TURN UDP 3478 and UDP 30000–30031. Open the selected ports in the firewall/provider panel and preserve port numbers through NAT. A website proxy does not replace the media path. PostgreSQL and web:3000 are not independently exposed. The wizard's TURN/TLS 443 requires direct public HTTPS, standard 80/443 and a separate TURN domain; an HTTP proxy does not automatically proxy TURN.

## Linux updates

The Linux helper `scripts/linux-compose-setup.py` provides `init`, `start`, `status`, `check-updates` and `update` with the existing `--state-dir`. UUIDs, secrets, networking and volume names persist; Windows/legacy installations are not adopted. The `backup` command is removed; save required data and configuration copies yourself.

```bash
python3 scripts/linux-compose-setup.py check-updates --state-dir /opt/castlink-manual --lang en
python3 scripts/linux-compose-setup.py update --state-dir /opt/castlink-manual --lang en
```

After an update passes readiness checks, cleanup removes only registered obsolete images owned by this installation and its temporary downloads. Recorded parent images require matching ownership labels; foreign, unknown and container-used images remain. No global Docker prune is performed. Database/data restoration is not automatic.
Compose diagnostics from the persistent directory:

```bash
docker compose -f compose.json config --quiet
docker compose -f compose.json ps
docker compose -f compose.json logs --tail 100
```

Check logs for secrets before sharing. Do not use `down -v`: it removes persistent volumes.

