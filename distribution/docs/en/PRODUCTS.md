[Русский](../../PRODUCTS.md) · [English](PRODUCTS.md) · [简体中文](../zh-CN/PRODUCTS.md)

# CastLink packages

**Server 1.0.9** adapts studio preview quality to its display size and requests caster video up to 1080p at 60 fps. Track diagnostics let you compare caster send and studio receive statistics. Choose the Windows/WSL2 or Linux package and verify its files against its `SHA256SUMS`. The Windows Client version is **1.0.3**.

Primary products: **Windows Server on WSL2 (no Docker Desktop)**, **Ubuntu/Linux Server** and a separate **Windows Client**. See [supported installation channels and migration limitations](../../SUPPORTED_INSTALLERS.md).

## Primary download channels

| CastLink | Purpose | Download |
| --- | --- | --- |
| Windows Server / WSL2 | Recommended Windows 11 server route; stable **1.0.9** | [1.0.9](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.9-35dbb73b5925) · [Installer](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.9-35dbb73b5925/install-server-windows.ps1) · [Maintenance ZIP](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.9-35dbb73b5925/CastLink-Server-WSL-Maintenance.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.9-35dbb73b5925/SHA256SUMS) |
| Linux Ubuntu | Independent Ubuntu/VPS server using Docker Engine/Compose | [1.0.9](https://github.com/resokol/castlink/releases/tag/linux-v1.0.9-2dbe8bc0271c) · [Installer](https://github.com/resokol/castlink/releases/download/linux-v1.0.9-2dbe8bc0271c/install-server.sh) · [CastLink-Linux.tar.gz](https://github.com/resokol/castlink/releases/download/linux-v1.0.9-2dbe8bc0271c/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.9-2dbe8bc0271c/SHA256SUMS) |
| Windows Client | Separate caster/studio application; does not install a server | [1.0.3](https://github.com/resokol/castlink/releases/tag/client-v1.0.3-35dbb73b5925) · [Installer](https://github.com/resokol/castlink/releases/download/client-v1.0.3-35dbb73b5925/CastLink-Client-1.0.3-35dbb73b5925-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.3-35dbb73b5925/SHA256SUMS) |

<a id="updater"></a>
## Persistent updater 1.0.0

A separate tool for supported Client, Windows/WSL2 and Linux installations. Install it **once on each computer**, then use the permanent shortcut or command; the current product versions are Client **1.0.3** and Server **1.0.9**. Checking does not apply an update; applying requires confirmation.

[Windows installer](https://castlink.ru/general/downloads/updater/install-updater-windows.cmd) · [Linux installer](https://castlink.ru/general/downloads/updater/install-updater-linux.sh) · [Step-by-step guide](UPDATER.md). Stable release: [`updater-v1.0.0-80b1a2c6f836`](https://github.com/resokol/castlink/releases/tag/updater-v1.0.0-80b1a2c6f836), source `80b1a2c6f8366a799e5bdbae2e015ac42ec3ac78`. [Manifest](https://github.com/resokol/castlink/releases/download/updater-v1.0.0-80b1a2c6f836/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/updater-v1.0.0-80b1a2c6f836/SHA256SUMS). The updater channel is independent of server and Client channels.

## Legacy: Windows Server / Docker Desktop

| CastLink | Status | Archived package |
| --- | --- | --- |
| Windows Server Setup / Docker | Existing installations only; no new official Windows/Docker releases | [1.0.4 release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1) · [ZIP](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.4-079fd0f9d4b1/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.4-079fd0f9d4b1/SHA256SUMS) |

There is **no supported automatic migration from Windows/Docker to Windows/WSL2**. Preserve existing Docker data. The former Windows SSH wizard is retained as Legacy; new remote Ubuntu/VPS servers should use the Linux installer over SSH.

**[Installation manual](LINUX_MANUAL.md)** — Out of the box and advanced.

Verify the selected release’s SHA256SUMS before running it. EXEs are unsigned. Client verifies updates before installation and requests separate consent; install manually if an older Client cannot find the release. Server updates require user action and can interrupt broadcasts. Back up needed data yourself; Windows Client, WSL2 and Linux have independent release channels; Windows/Docker is Legacy.

Server Setup build: `1.0.4-079fd0f9d4b1` · source: `079fd0f9d4b18215274ff401ba584435e263994f`

Windows/WSL build: `1.0.9-35dbb73b5925` · source: `35dbb73b5925797e753d395843a37f39c23f579d`

Linux build: `1.0.9-2dbe8bc0271c` · source: `2dbe8bc0271c1cfca648d95bae76aa1a7b3d1a22`

Client build: `1.0.3-35dbb73b5925` · source: `35dbb73b5925797e753d395843a37f39c23f579d`

**1.0.6:** Studio statistics adds Video diagnostics → JSON: sender and receiver history with available frame and freeze counters. [Release notes](RELEASE_NOTES_1_0_6.md).

Source 1.0.7: [web / Windows](https://github.com/resokol/castlink/tree/0d16de2e782cd2e847e9824024c5b788a080a59b) · [ZIP](https://github.com/resokol/castlink/archive/0d16de2e782cd2e847e9824024c5b788a080a59b.zip) · [Linux](https://github.com/resokol/castlink/tree/ac9c234c72b02ea594c2363d36611b1d732502d8) · [1.0.7 release notes](RELEASE_NOTES_1_0_7.md).

**1.0.4:** network quality guide in caster cards; Windows Client updated to 1.0.1. [1.0.4](RELEASE_NOTES_1_0_4.md).

**1.0.3:** one noise/echo switch, off by default; the primary studio can change it in the caster card. [1.0.3](RELEASE_NOTES_1_0_3.md).

**Server 1.0.2:** 24-hour metric history and an event journal in Super Admin survive restarts. Linux also includes [install-server.sh](https://github.com/resokol/castlink/releases/download/linux-v1.0.9-2dbe8bc0271c/install-server.sh) for one-command installation. [Instructions](SERVER_INSTALL.md) · [1.0.2 release notes](RELEASE_NOTES_1_0_2.md).

Windows/WSL2 is the primary Windows server channel. Its stable server version is 1.0.9. Update existing WSL installations with the matching maintenance ZIP off air, then reload studio and caster pages. Old Windows/Docker Server Setup is Legacy.

**Updating existing servers:** update WSL2 or Linux to 1.0.9 off air using its own maintenance tool and existing data directory. Legacy Windows/Docker remains at 1.0.4. Connection recovery requires 1.0.1 or later on both servers. Windows Client is 1.0.3; use its built-in update check. If an older Client cannot find the release, download the 1.0.3 installer manually once using the link above and verify SHA256SUMS. [Connection recovery](GUIDE.md#server-pair-recovery) · [Changelog](../../../CHANGELOG.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.3-35dbb73b5925) · [Windows WSL2 release](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.9-35dbb73b5925) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.9-2dbe8bc0271c) · [Docker Legacy release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1)

Server 1.0.4 source: [release](https://github.com/resokol/castlink/releases/tag/source-v1.0.4-079fd0f9d4b1) · [exact commit](https://github.com/resokol/castlink/tree/079fd0f9d4b18215274ff401ba584435e263994f) · [ZIP](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/CastLink-Source-1.0.4.zip) · [tar.gz](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/CastLink-Source-1.0.4.tar.gz) · [manifest.json](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/SHA256SUMS). The source is MIT-licensed; its archive is not an installer. Current development: [main branch](https://github.com/resokol/castlink/tree/main).

## Instructions and published archives

Text instructions inside an already published archive reflect its build-time snapshot. Current instructions live in this repository; updating them does not alter installed files or published package SHA256 values. New behavior needs the corresponding package, and an older Linux installation missing its password needs an explicit recovery command.

## One repository

CastLink has one public repository, [resokol/castlink](https://github.com/resokol/castlink), for its MIT-licensed source, releases and instructions. Archives and `SHA256SUMS` do not require separately granted access. The former name `resokol/castlink-releases` redirects here for compatibility with old links and installers; it is not a separate mirror. A shared `releases/latest` does not select all three products.

Earlier archives were copied without rebuilding: names, embedded build/source IDs and checksums are preserved. The table maps each original build commit to the repository's current history; a new source link does not mean a new binary package.

| Original build commit | Source in current history |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
