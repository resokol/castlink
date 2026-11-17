# Server installation and monitoring

[Русский](../../SERVER_INSTALL.md) · [English](SERVER_INSTALL.md) · [简体中文](../zh-CN/SERVER_INSTALL.md)

This guide applies to Windows Server Setup and standalone Linux **1.0.5**; Windows Client remains **1.0.1**. The source package version is **1.0.5**. Available releases, exact source/build IDs and checksums are listed in the [product catalog](PRODUCTS.md). [1.0.5 changes](RELEASE_NOTES_1_0_5.md).

Server **1.0.2** introduced [one-command Linux installation, 24-hour metric history and an event journal](RELEASE_NOTES_1_0_2.md). The ordinary local Windows Server Setup uses Docker Desktop. Docker-free Windows/WSL2 remains a separate experimental channel and is not part of these stable server packages.

Update the server off air through an explicit update action, selecting the existing installation and retaining its data and configuration; keep the same Linux `--state-dir`. Publishing a package does not update a running server. After readiness checks, manually reload **both studio and caster pages**, including pages in Windows Client: the client displays its selected server interface.

## Ubuntu Linux

The command below installs stable **1.0.5**. For step-by-step Windows and Linux installation, see the [main guide](../../../README.en.md).

Ubuntu22.04/24.04 amd64 is supported. The Linux channel adds a self-contained
`install-server.sh` pinned to its release and archive SHA256. Use this exact 1.0.5 asset URL, rather than global `releases/latest`:

```bash
curl -fsSL https://github.com/resokol/castlink/releases/download/linux-v1.0.5-732ad5fe7006/install-server.sh | sudo bash -s -- --install-runtime --lang en
```

The **linux-v1.0.5-732ad5fe7006** bootstrap asks for the
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

## Docker-free Windows/WSL2 — separate experimental channel

The [1.0.5-rc.2 installer](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.5-rc.2-af3e309d0926) is available as a prerelease. See [installation steps and limitations](../../../README.en.md#windows-11-server).

Requires Windows11 x64 build22621+, WSL2 version2.4.13+, and virtualization. The
separate `server-wsl-v…` channel provides `install-server-windows.ps1` and a ready
Ubuntu server filesystem. Docker Desktop/Engine, source compilation and manual
Node/PostgreSQL installation are unnecessary. This is a WSL server, not native
Windows services. Download the script from the exact selected published release,
verify `SHA256SUMS`, then run in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1 -Action Install
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

### Maintenance: update, remove and restore

Download [CastLink-Server-WSL-Maintenance.zip](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.5-rc.2-af3e309d0926/CastLink-Server-WSL-Maintenance.zip) from **that same release**, extract the entire ZIP and double-click **CastLink-Maintenance.cmd**. [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.5-rc.2-af3e309d0926/SHA256SUMS). The new panel's **Maintenance** button opens the same tool. Version 1.0.5-rc.1 needs this separate tool; its original installer does not update itself.

**Select and update.** Select the exact server by address and folder; do not silently choose the first of several. An incomplete installation may have an unknown address, so check its folder. Select a target release, click **Check** and review current/target versions and required/free space. The tool downloads and verifies the needed files before stopping services. Checking never starts an update; prereleases require explicit selection. The normal window does not ask you to type SHA256 values or an opaque WSL ID.

Click **Update** only outside a broadcast: the server stops during transfer and readiness checks. The confirmation displays the selected address, version and folder and can be cancelled. The first supported source is exactly `server-wsl-v1.0.5-rc.1-085b087a2458`. Other source versions, Docker migration and a different PostgreSQL major are unsupported. Repair an incomplete source with its original release, or remove it through this tool; Update does not pretend it is ready.

A supported upgrade preserves server UUID, rooms/history, passwords, domain, TLS material and network settings. Successful updates remove the temporary transfer and the old owned distribution: **no permanent automatic backup remains**. Failures retain needed recovery evidence. On success, click **Open server panel**, then reload both studio and caster pages.

**Remove.** **Keep a restorable archive before removing** is selected by default. Choose a location outside the installation folder and click **Remove**; the tool creates and validates a new archive folder before removing the server. Alternatively, explicitly choose **Permanently erase server and data**. Confirmation identifies the selected server and whether an archive is retained; cancelling does not start the operation.

The restore archive is a **folder** containing `bundle.json`, the full `distribution.tar` export and verified helpers for the saved release. It is neither the maintenance ZIP nor the 24-hour statistics export. It contains passwords, keys and other credentials: keep the whole folder private and do not upload it as an ordinary diagnostic file. Keep its files together.

**Restore.** In the same window, select the archive folder and **Restore**. Choose a parent inside `%LOCALAPPDATA%\CastLinkServer`; the folder dialog proposes a new destination name. The destination must not already exist; it is not merged with another installation. Restore recreates the saved release with its identity/settings and refuses conflicting installed servers or ports. An incomplete saved installation restores as incomplete, without an application-readiness claim.

**After an interruption.** Open the same tool, select the same server and choose **Recover transaction**. Keep its data; do not manually start an old shortcut or use Install as a recovery step. After switching to a new release, recovery repairs that release; it never silently substitutes old data for data that may already have changed. Uncertain distribution ownership is preserved for manual inspection.

Maintenance affects only the selected server. Other installations, nested folders, unknown files and manually saved exports remain; shared WSL/firewall settings are retained. Deleting AppData manually, global `wsl --shutdown`, or unregister commands are not normal maintenance steps.

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
