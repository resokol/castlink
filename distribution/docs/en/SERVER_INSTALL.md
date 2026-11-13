# Server installation and monitoring

[Русский](../../SERVER_INSTALL.md) · [English](SERVER_INSTALL.md) · [简体中文](../zh-CN/SERVER_INSTALL.md)

The Linux bootstrap and server charts with 24-hour history and an event journal are included in **1.0.2**. [Packages and checksums](PRODUCTS.md) · [Release notes](RELEASE_NOTES_1_0_2.md). The ordinary local Windows Server Setup 1.0.2 uses Docker Desktop. Docker-free Windows/WSL2 below remains a separate candidate without verified installation and external media-call tests.

## Ubuntu Linux

Ubuntu22.04/24.04 amd64 is supported. The Linux channel adds a self-contained
`install-server.sh` pinned to its release and archive SHA256. Use this exact 1.0.4 asset URL, rather than global `releases/latest`:

```bash
curl -fsSL https://github.com/resokol/castlink/releases/download/linux-v1.0.4-079fd0f9d4b1/install-server.sh | sudo bash -s -- --install-runtime --lang en
```

The **linux-v1.0.4-079fd0f9d4b1** bootstrap asks for the
server address and room creation password, stores its package/configuration at
`/opt/castlink-server`, loads bundled images and runs the existing Linux installer.
`--install-runtime` authorizes prerequisites and starting Docker; otherwise Docker
and Compose must already work. DNS, router forwarding and external firewall rules
remain operator settings. [Ports and modes](LINUX_MANUAL.md).

Rerunning preserves data, UUID, secrets and release; it does not update or restart
a completed installation. Its saved address is not a fresh health check: run the
saved helper's `status` command. Keep the same absolute `--state-dir` for custom
locations. Unattended setup supports `--config` and
`--room-creation-password-file` (UTF-8 without a trailing newline).

## Docker-free Windows/WSL2 — unverified candidate

Requires Windows11 x64 build22621+, WSL2 version2.4.13+, and virtualization. The
separate `server-wsl-v…` channel provides `install-server-windows.ps1` and a ready
Ubuntu server filesystem. Docker Desktop/Engine, source compilation and manual
Node/PostgreSQL installation are unnecessary. This is a WSL server, not native
Windows services. Download the script from the exact selected published release,
verify `SHA256SUMS`, then run in PowerShell:

```powershell
& .\install-server-windows.ps1 -Action Install
```

Setup asks for address/password, verifies the rootfs SHA256 and creates only its
own distribution. First-time WSL enablement may need administrator consent and a
reboot; rerun the same command afterwards. No automatic reboot occurs. Conflicting
ports, settings and foreign distributions are preserved. Mirrored networking is a
shared WSL setting. `networkingMode=mirrored` and `[experimental]
hostAddressLoopback=true` are required; the latter lets this PC access its server
through its assigned IPv4 address. Only missing settings are added after explicit
consent. Then restart Windows or wait for the WSL VM to stop completely and rerun
the same command. The installer never runs global `wsl --shutdown` or overwrites
an existing `false` value.
An interrupted import before its identity marker is saved requires manual review;
the distribution is retained rather than adopted or deleted automatically.

The server distribution disables Windows drive mounts and Windows executable
interop. PPTX conversion has a separate unprivileged user, no network and resource
limits. Required ports: TCP80/443/7881, UDP3478/7882/30000–30031. Domain deployments
also need `turn.<domain>` resolving to the same IP. External access depends on NAT
and firewall. Local CA trust is an explicit current-Windows-user choice; other
client devices also need trust. HTTPS/database readiness does not prove an external
media call. Use `-Action Start`, `Stop`, `Status`, or `OwnerAccess` with the same
installer. Stop retains data. Existing Docker deployments are not migrated or
upgraded by this installer.

A background process keeps only the owned WSL distribution running after the
installer window closes. Optional autostart runs at the current Windows user's
logon after explicit consent. An explicit `Stop` preserves the stopped state.

## Graphs and owner access

**Super Admin** displays active/stored rooms, connections, casters, CPU, RAM, disk,
network rates, web process memory/uptime and observable service state. Participant
identities and secrets are excluded. Room administrator access does not authorize
server metrics. Windows saves a single-use owner URL in a private local file;
`-Action OwnerAccess` issues another when needed. On Linux:

```bash
sudo python3 /opt/castlink-server/.castlink-package/scripts/linux-compose-setup.py owner-access \
  --state-dir /opt/castlink-server --owner-access-file /root/castlink-owner-access.txt
```

The invitation is single-use, expires after15minutes and is stored0600 without
printing the URL. Read locally and open it; do not share it.

Sampling runs about every 15 seconds, independently of the browser. Measurements
and CastLink's structured event journal retain the last 24 hours across restarts;
expired records are removed automatically. Select 1/6/24-hour charts, event levels,
or pages of 50 events. Longer charts explicitly show interval peaks; labels show
the latest raw sample. A bounded number of points keeps the browser responsive.

The private `runtime/server-observability.sqlite` file stays in the existing server
data directory; no extra database service is required. Database/WAL size and event
count are bounded, so high event volume can evict old entries before 24 hours.
Passwords, cookies, tokens and request bodies are excluded. This journal records
application events and service availability transitions, not all operating-system
logs. Recording failures are visible; console output continues.

Missing/stale data differs from zero; first
CPU/network rates await a second sample. WSL metrics describe the Linux guest.
In Docker, CPU/RAM describe the kernel host, disk the data filesystem and network
the web container's namespace, not aggregate traffic or container quota. Labels
make these scopes explicit.
