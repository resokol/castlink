[Русский](README.md) · **English** · [简体中文](README.zh-CN.md)

# CastLink

Connect remote guests in a browser and receive separate audio/video feeds for OBS or vMix.

Choose where to install your server:

| System | Installer |
| --- | --- |
| Windows 11 | Full **1.0.6-rc.1** installer without Docker Desktop. Published prerelease. |
| Ubuntu Linux / VPS | One `curl` command, stable **1.0.5**. |

Joining someone else's server only requires a browser. The [Windows client](https://github.com/resokol/castlink/releases/download/client-v1.0.1-079fd0f9d4b1/CastLink-Client-1.0.1-079fd0f9d4b1-setup.exe) is a separate app; it does not install a server.

## Before installation

- Keep the server computer powered on while using CastLink.
- For internet access, prepare a domain or public IPv4. Point the domain's DNS **A** record at the server. On Windows, also point `turn.YOUR-DOMAIN` at the same IP.
- Behind a router, forward **TCP 80, 443, 7881; UDP 3478, 7882, 30000–30031** to the server. Allow these ports in your VPS firewall too. The installer does not configure DNS or your router.
- A local IPv4 works for LAN testing; client devices must trust the server's local HTTPS certificate.
- With CGNAT, port forwarding alone is insufficient. Request a public IPv4 from your ISP or use an Ubuntu VPS.

## Windows 11 server

Requires **Windows 11 x64 22H2/build 22621 or later**, enabled virtualization and internet. The installer uses WSL 2. You do not need to install Docker Desktop, Node.js or PostgreSQL yourself.

### 0. Prepare WSL

Open **PowerShell as administrator**:

```powershell
wsl --version
```

If WSL is missing, run `wsl --install --no-distribution`, then **restart Windows**. Afterwards (or if WSL is already installed):

```powershell
wsl --update
wsl --version
```

Requires WSL **2.4.13+**. Reboot if requested; resolve any errors before continuing. No separate Ubuntu installation is needed.

Moving from Docker? Stop the old CastLink server and quit Docker Desktop. Keep the old data; it is not migrated automatically.

### 1. Download

**[Download install-server-windows.ps1](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.6-rc.1-dad063393b53/install-server-windows.ps1)**

It downloads the server files automatically. No separate hotfix or source archive is needed.

### 2. Run

Open the download folder, type `powershell` in File Explorer's address bar and press Enter. Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1
```

Use the command above instead of double-clicking the file.

**If the script requests a reboot:** `Shared WSL settings saved. Restart Windows...` means new network settings were saved. Even if you rebooted after installing WSL, **save your work and restart Windows again**. Open PowerShell **in the same folder** and repeat the command above to resume. Do not delete the files.

### 3. Answer the prompts

For `[y/N]`, type `y` and press Enter to agree; an empty answer declines. Some prompts only appear on first installation.

| Prompt / step | What to do |
| --- | --- |
| Install WSL components | Enter `y` and accept Windows elevation. If a reboot is requested, reboot and run the same command again. |
| Public hostname or IPv4 address | Enter your domain or IPv4 **without** `https://`, a port or a path. Replace examples such as `meet.example.com` with your own address. |
| Add `networkingMode=mirrored` and `hostAddressLoopback=true` | These configure WSL networking. On a dedicated server PC, accept with `y`. If a WSL/Windows restart is requested, reboot and rerun. The installer will not stop other running WSL systems. |
| Add firewall rules | Enter `y` and accept Windows elevation. |
| Media IPv4, when using a domain | Enter the server IPv4 reachable by participants: public for internet access, local for LAN testing. |
| Room-creation password and confirmation | Create and save a separate password, then repeat it. Typed characters are hidden. |
| Trust this server's certificate | Only approve for your own server. Local certificates also need trust on other participant devices. |
| Start at Windows sign-in | `y` enables startup when **your user** signs in; `n` leaves manual startup. |

Allow several minutes for download and setup. Keep the window open. After a requested reboot, rerun the **same installer** to resume.

### 4. Check the result

The **CastLink Server** panel opens after installation. Wait for its running status and click **Open CastLink**. Use your new password to create a room.

The panel provides service controls, statistics and **Export ZIP for 24 hours**. Closing the window hides it in the tray; use **Stop services** to stop the server. Test from another device; use a phone on mobile data to verify internet access.

**Release status:** **1.0.6-rc.1** is a published prerelease. Maintain an existing server through the tool below; do not install over its data. [Release](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.6-rc.1-dad063393b53) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.6-rc.1-dad063393b53/SHA256SUMS).

### Update, remove or restore a WSL server

1. Download the [maintenance ZIP](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.6-rc.1-dad063393b53/CastLink-Server-WSL-Maintenance.zip), extract it and double-click **CastLink-Maintenance.cmd**. The new panel's **Maintenance** button opens the same tool; version 1.0.5-rc.1 needs the separate ZIP.
2. Select the server by address and folder, then select target release **1.0.6-rc.1**. Click **Check**, review current/target versions and disk space, then **Update**. Updating interrupts service: do it outside a broadcast. Confirm the displayed server; no manual checksum or WSL ID entry is needed.
3. To remove it, choose **Keep a restorable archive before removing** or **Permanently erase server and data**, then **Remove**. The saved archive is a **folder** containing a full export and restore helpers, not a statistics ZIP. It contains credentials; keep the whole folder private.
4. **Restore** uses that archive folder and a new installation folder that does not yet exist under `%LOCALAPPDATA%\CastLinkServer`. After an interruption, select the same server and **Recover transaction**. On success, use **Open server panel**.

Supported upgrade sources are `server-wsl-v1.0.5-rc.1-085b087a2458`, `server-wsl-v1.0.5-rc.2-af3e309d0926` and `server-wsl-v1.0.5-rc.3-95ec46463c82`. Supported updates preserve rooms, history, passwords, address and certificates; successful updates leave no permanent automatic backup. Migration from Docker is unsupported. [Details](distribution/docs/en/SERVER_INSTALL.md) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.6-rc.1-dad063393b53/SHA256SUMS).

## Ubuntu Linux server

Supports **Ubuntu 22.04 / 24.04, x86-64/amd64**. Connect over SSH with a user who has `sudo` privileges.

### 1. Run one command

```bash
curl -fsSL https://github.com/resokol/castlink/releases/download/linux-v1.0.6-bc0679d83df8/install-server.sh | sudo bash -s -- --install-runtime --lang en
```

This pinned **1.0.5** installer verifies the server archive, installs required Docker Engine/Compose and Python, and uses **`/opt/castlink-server`**.

If `curl` is missing, run this first, then repeat installation:

```bash
sudo apt-get update && sudo apt-get install -y curl
```

### 2. Answer the prompts

| Prompt | Answer |
| --- | --- |
| `sudo` password, if requested | Your Ubuntu user's system password. Input is hidden. |
| External server address | Your full address, such as `https://meet.example.com` or `https://YOUR-IP`. **Do not keep `127.0.0.1`** for access from other devices. |
| Media IPv4, if requested | The server's reachable IPv4. Asked when it cannot be determined unambiguously. |
| Room-creation password and confirmation | A new separate **8–256 character** password. It is not your SSH/sudo password. Input is hidden; save it. |

Quick mode chooses ports and HTTPS mode automatically. Local addresses use a local certificate; configure trust separately on participant devices.

### 3. Wait for startup

Installation is complete when these lines appear:

```text
CastLink setup completed: https://YOUR-ADDRESS
Installation: /opt/castlink-server
```

Open the displayed address, create a room with your password and test another device.

### 4. Manage the server

Check status:

```bash
sudo python3 /opt/castlink-server/.castlink-package/scripts/linux-compose-setup.py status --state-dir /opt/castlink-server --lang en
```

Replace `status` with `start` to start it. Stop while keeping data:

```bash
sudo docker compose -f /opt/castlink-server/compose.json stop
```

Repeating `curl` **does not update** a completed installation. Replace `status` with `update` above to update outside a broadcast, keeping the same data directory. Then reload both studio and caster pages.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Windows requests a reboot or reports WSL is running | Save your work, reboot and rerun the same installer. Keep the installed system and data. |
| Unreadable error containing `wsl.exe --install` | WSL output may have been decoded incorrectly. Check `wsl --version` and follow the WSL preparation step above. Line 742 is where the error is reported, not its cause. |
| Virtualization unavailable | Enable Intel VT-x / AMD-V in BIOS/UEFI. |
| Address does not open | IP/DNS A record, running services, firewall and port forwarding. For Windows domains, check `turn.YOUR-DOMAIN` too. |
| Page loads but media fails | Media IPv4 and UDP ports listed above. TCP 443 alone does not prove media connectivity. |
| LAN certificate warning | Trust your server's **public root certificate** on each device. Do not disable TLS verification. [Linux certificate export](distribution/docs/en/LINUX_MANUAL.md). |
| Port conflict / another installation | Stop the conflicting service before using the same ports; keep its data. |

Linux diagnostics:

```bash
sudo docker compose -f /opt/castlink-server/compose.json ps
sudo docker compose -f /opt/castlink-server/compose.json logs --tail 100
```

## More

- [Website](https://castlink.ru) · [User guide](distribution/docs/en/GUIDE.md) · [Releases](https://github.com/resokol/castlink/releases) · [Changelog](CHANGELOG.md).
- The older Docker/SSH `EasySetup.exe` is an [alternative installation method](distribution/docs/en/INSTALL.md); it is not required for the Windows instructions above.
- Development: [CONTRIBUTING](CONTRIBUTING.md), [project guide](docs/PROJECT_GUIDE_RU.md), [technical invariants](docs/CRITICAL_INVARIANTS_RU.md). Installing a packaged server does not require Git or a source build.
- [Report an issue](https://github.com/resokol/castlink/issues) · [Security](SECURITY.md) · [Contact / support the author](https://t.me/sklvmax).

Project code: [MIT](LICENSE). Third-party components retain their own licenses: [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES). Older Client `f6c47a27a62c` and Server Setup/Linux `d703726cd50b` packages retain their bundled Freeware Distribution License 1.1; the current MIT license does not change those packages.
