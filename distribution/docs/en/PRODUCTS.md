[Русский](../../PRODUCTS.md) · [English](PRODUCTS.md) · [简体中文](../zh-CN/PRODUCTS.md)

# CastLink packages

| CastLink | Purpose | Download |
| --- | --- | --- |
| Windows Client | Windows app: studio and caster | [1.0.0](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/CastLink-Client-1.0.0-93d9b93e17da-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/SHA256SUMS) |
| Windows Server | Windows wizard: own server locally or on Linux Ubuntu over SSH | [1.0.1](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.1-eaa94d193230/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.1-eaa94d193230/SHA256SUMS) |
| Linux Ubuntu | Standalone server installation on Linux Ubuntu | [1.0.1](https://github.com/resokol/castlink/releases/download/linux-v1.0.1-eaa94d193230/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.1-eaa94d193230/SHA256SUMS) |

**[Installation manual](LINUX_MANUAL.md)** — Out of the box and advanced.

Verify the selected release’s SHA256SUMS before running it. EXEs are unsigned. Client verifies updates before installation and requests separate consent; install manually if an older Client cannot find the release. Server updates require user action and can interrupt broadcasts. Back up needed data yourself; the three tracks release independently.

Server Setup build: `1.0.1-eaa94d193230` · source: `eaa94d193230a39647292dcb1b8bb3061fd67ef1`

Linux build: `1.0.1-eaa94d193230` · source: `eaa94d193230a39647292dcb1b8bb3061fd67ef1`

Client build: `1.0.0-93d9b93e17da` · source: `93d9b93e17daced23b3eb4207c8464d6091bea0c`

**Upgrading servers to 1.0.1:** update Server Setup or Linux off air, selecting the existing installation. Connection recovery requires 1.0.1 or later on both servers. Windows Client stays at 1.0.0; use its built-in update check. If an older Client cannot find the release, download the 1.0.0 installer manually once using the link above and verify SHA256SUMS. [Connection recovery](GUIDE.md#server-pair-recovery) · [Changelog](../../../CHANGELOG.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-93d9b93e17da) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.1-eaa94d193230) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.1-eaa94d193230)

Application source: [main branch](https://github.com/resokol/castlink/tree/main) · [main ZIP](https://github.com/resokol/castlink/archive/refs/heads/main.zip). Package versions and build source commits are listed above.

## Instructions and published archives

Text instructions inside an already published archive reflect its build-time snapshot. Current instructions live in this repository; updating them does not alter installed files or published package SHA256 values. New behavior needs the corresponding package, and an older Linux installation missing its password needs an explicit recovery command.

## One repository

CastLink has one public repository, [resokol/castlink](https://github.com/resokol/castlink), for its MIT-licensed source, releases and instructions. Archives and `SHA256SUMS` do not require separately granted access. The former name `resokol/castlink-releases` redirects here for compatibility with old links and installers; it is not a separate mirror. A shared `releases/latest` does not select all three products.

The archives were copied without rebuilding: names, embedded build/source IDs and checksums are preserved. The table maps each original build commit to the repository's current history; a new source link does not mean a new binary package.

| Original build commit | Source in current history |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
