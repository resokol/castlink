[Русский](../../PRODUCTS.md) · [English](PRODUCTS.md) · [简体中文](../zh-CN/PRODUCTS.md)

# CastLink packages

| CastLink | Purpose | Download |
| --- | --- | --- |
| Windows Client | Windows app: studio and caster | [1.0.0-rc.9](https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.9-a994895c5fa9/CastLink-Client-1.0.0-rc.9-a994895c5fa9-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.9-a994895c5fa9/SHA256SUMS) |
| Windows Server | Windows wizard: own server locally or on Linux Ubuntu over SSH | [1.0.0-rc.9](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.9-7ff7880b402f/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.9-7ff7880b402f/SHA256SUMS) |
| Linux Ubuntu | Standalone server installation on Linux Ubuntu | [1.0.0-rc.9](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.9-7ff7880b402f/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.9-7ff7880b402f/SHA256SUMS) |

**[Installation manual](LINUX_MANUAL.md)** — Out of the box and advanced.

Verify the selected release's SHA256SUMS before running it. EXEs are unsigned. The new Client offers verified updates, but installation needs separate consent; replace older Clients manually. Server updates require user action and can interrupt broadcasts. Back up needed data yourself; the three tracks release independently.

Server Setup build: `1.0.0-rc.9-7ff7880b402f` · source: `7ff7880b402fb83db02301678cab52c29912fbe0`

Linux build: `1.0.0-rc.9-7ff7880b402f` · source: `7ff7880b402fb83db02301678cab52c29912fbe0`

Client build: `1.0.0-rc.9-a994895c5fa9` · source: `a994895c5fa976a073965f845ba23a4f61f94387`

**Upgrading from rc.8:** an older Client may not find the release after the repository rename. Download the rc.9 installer manually once using the link above and verify SHA256SUMS. Update Server Setup or Linux separately for your own server. [Changes and update steps](RELEASE_NOTES_RC9.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-rc.9-a994895c5fa9) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.0-rc.9-7ff7880b402f) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.0-rc.9-7ff7880b402f)

## Instructions and published archives

Text instructions inside an already published archive reflect its build-time snapshot. Current instructions live in this repository; updating them does not alter installed files or published package SHA256 values. New behavior needs the corresponding package, and an older Linux installation missing its password needs an explicit recovery command.

## One repository

CastLink has one public repository, [resokol/castlink](https://github.com/resokol/castlink), for its MIT-licensed source, releases and instructions. Archives and `SHA256SUMS` do not require separately granted access. The former name `resokol/castlink-releases` redirects here for compatibility with old links and installers; it is not a separate mirror. A shared `releases/latest` does not select all three products.

The archives were copied without rebuilding: names, embedded build/source IDs and checksums are preserved. The table maps each original build commit to the repository's current history; a new source link does not mean a new binary package.

| Original build commit | Source in current history |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
