# CastLink installation: quick and advanced

[Русский](../../INSTALL.md) · [English](INSTALL.md) · [简体中文](../zh-CN/INSTALL.md)

This guide applies to packages advertising `network-modes-v1` and `linux-compose-v1`. Updating documentation does not add these features to older packages.

## Windows

Extract the complete `CastLink-Windows.zip`, open `EasySetup.exe`, select installation, then choose:

- **Quick (recommended)** — HTTPS, standard ports, generated secrets and database setup. Select the target and address. Local installations use a private certificate and a portable trust kit; VPS installations use a public certificate. Reserve servers can be added later.
- **Advanced** — direct HTTPS, HTTP or an external HTTPS proxy; public site URL, listening IPv4, site ports, trusted proxies, separate media IPv4, media TCP/UDP and TURN relay range. JSON configuration is also accepted through `-NetworkConfigPath`.

The language buttons switch Russian, English and Simplified Chinese without resetting inputs. When updating, select the existing installation: network settings, UUIDs, secrets and volumes are retained. Updating does not automatically change its network layout.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-simple-easy-setup.ps1 -SetupMode advanced -NetworkConfigPath network.json
```

## Linux without the Windows wizard

Requirements: Linux amd64, Python 3.8+, Docker and Docker Compose v2. Verify the official `CastLink-Linux.tar.gz` against `SHA256SUMS`. Extract each release into a separate directory. The helper verifies packaged files against the manifest and loads the included images; Docker Hub and private GitHub access are unnecessary for images.

From the extracted package:

```bash
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --lang en
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang en
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang en
```

Use `ru` or `zh-CN` for other languages. `init` asks for quick/advanced setup and writes configuration; `start` loads images, starts services and initializes the database. Local HTTPS requires trusting the generated CA on client devices. Public HTTPS requires working DNS/public IP and reachable ACME ports. Verify real audio/video with a separate connection.

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

## Linux updates and backups

End live sessions before updating: services restart. From the **new**, verified extracted package, using the same persistent directory:

```bash
python3 scripts/linux-compose-setup.py backup --state-dir /opt/castlink-manual --lang en
python3 scripts/linux-compose-setup.py update --state-dir /opt/castlink-manual --lang en
```

`update` creates its own verified PostgreSQL, web-data and configuration backup before loading new images. It briefly pauses web for a consistent file snapshot and resumes it even if backup fails. UUIDs, secrets, network settings and volume names persist. On failure, retain the directory, volumes and backups; retry `start` to finish the selected release. Database/data rollback is not automatic: older code may be incompatible with newer data.

Compose diagnostics from the persistent directory:

```bash
docker compose -f compose.json config --quiet
docker compose -f compose.json ps
docker compose -f compose.json logs --tail 100
```

Check logs for secrets before sharing. Do not use `down -v`: it removes persistent volumes.
