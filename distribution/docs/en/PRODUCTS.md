[Русский](../../PRODUCTS.md) · [English](PRODUCTS.md) · [简体中文](../zh-CN/PRODUCTS.md)

# CastLink packages

| CastLink | Purpose | Download |
| --- | --- | --- |
| Windows Client | Windows app: studio and caster | [1.0.0](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/CastLink-Client-1.0.0-93d9b93e17da-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/SHA256SUMS) |
| Windows Server | Windows wizard: own server locally or on Linux Ubuntu over SSH | [1.0.3](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.3-1a26de9f6f59/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.3-1a26de9f6f59/SHA256SUMS) |
| Linux Ubuntu | Standalone server installation on Linux Ubuntu | [1.0.3](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/SHA256SUMS) |

**[Installation manual](LINUX_MANUAL.md)** — Out of the box and advanced.

Verify the selected release’s SHA256SUMS before running it. EXEs are unsigned. Client verifies updates before installation and requests separate consent; install manually if an older Client cannot find the release. Server updates require user action and can interrupt broadcasts. Back up needed data yourself; the three tracks release independently.

Server Setup build: `1.0.3-1a26de9f6f59` · source: `1a26de9f6f59cc95e84708e6e259bc0503daae38`

Linux build: `1.0.3-1a26de9f6f59` · source: `1a26de9f6f59cc95e84708e6e259bc0503daae38`

Client build: `1.0.0-93d9b93e17da` · source: `93d9b93e17daced23b3eb4207c8464d6091bea0c`

**1.0.3:** one noise/echo switch, off by default; the primary studio can change it in the caster card. [1.0.3](RELEASE_NOTES_1_0_3.md).

**Server 1.0.2:** 24-hour metric history and an event journal in Super Admin survive restarts. Linux also includes [install-server.sh](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/install-server.sh) for one-command installation. [Instructions](SERVER_INSTALL.md) · [1.0.2 release notes](RELEASE_NOTES_1_0_2.md).

The ordinary local Windows Server Setup requires Docker Desktop with Linux containers. Docker-free Windows/WSL2 is a separate candidate without verified installation and external media-call tests; this table does not offer a stable WSL package.

**Upgrading servers to 1.0.3:** update Server Setup or Linux off air, selecting the existing installation. Connection recovery requires 1.0.1 or later on both servers. Windows Client stays at 1.0.0; use its built-in update check. If an older Client cannot find the release, download the 1.0.0 installer manually once using the link above and verify SHA256SUMS. [Connection recovery](GUIDE.md#server-pair-recovery) · [Changelog](../../../CHANGELOG.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-93d9b93e17da) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.3-1a26de9f6f59) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.3-1a26de9f6f59)

Server 1.0.3 source: [release](https://github.com/resokol/castlink/releases/tag/source-v1.0.3-1a26de9f6f59) · [exact commit](https://github.com/resokol/castlink/tree/1a26de9f6f59cc95e84708e6e259bc0503daae38) · [ZIP](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/CastLink-Source-1.0.3.zip) · [tar.gz](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/CastLink-Source-1.0.3.tar.gz) · [manifest.json](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/SHA256SUMS). The source is MIT-licensed; its archive is not an installer. Current development: [main branch](https://github.com/resokol/castlink/tree/main).

## Instructions and published archives

Text instructions inside an already published archive reflect its build-time snapshot. Current instructions live in this repository; updating them does not alter installed files or published package SHA256 values. New behavior needs the corresponding package, and an older Linux installation missing its password needs an explicit recovery command.

## One repository

CastLink has one public repository, [resokol/castlink](https://github.com/resokol/castlink), for its MIT-licensed source, releases and instructions. Archives and `SHA256SUMS` do not require separately granted access. The former name `resokol/castlink-releases` redirects here for compatibility with old links and installers; it is not a separate mirror. A shared `releases/latest` does not select all three products.

Earlier archives were copied without rebuilding: names, embedded build/source IDs and checksums are preserved. The table maps each original build commit to the repository's current history; a new source link does not mean a new binary package.

| Original build commit | Source in current history |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
