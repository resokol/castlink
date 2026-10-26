[Русский](README.md) · **English** · [简体中文](README.zh-CN.md)

<p align="center">
  <a href="https://castlink.ru"><img src="assets/brand/castlink-logo.svg" width="112" height="112" alt="CastLink logo"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>CastLink 1.0.0-rc.8</strong></p>
<p align="center"><strong>Remote guests. Separate sources. Your broadcast.</strong></p>
<p align="center">Join in a browser · OBS and vMix · Self-hosted</p>
<p align="center">
  <a href="https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/CastLink-Client-1.0.0-rc.8-f6c47a27a62c-setup.exe"><strong>Windows Client</strong></a> · <a href="https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/CastLink-Windows.zip"><strong>Windows Server</strong></a> · <a href="https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.8-d703726cd50b/CastLink-Linux.tar.gz"><strong>Linux Ubuntu</strong></a>
</p>
<p align="center">
  <a href="https://castlink.ru">Website</a> &nbsp; / &nbsp;
  <a href="distribution/INSTALL.md">Installation</a> &nbsp; / &nbsp;
  <a href="CHANGELOG.md">What’s new</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax">Contact</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax"><strong>♡ Support CastLink</strong></a>
</p>

<p align="center">Open source under <a href="LICENSE">MIT</a> · <a href="distribution/PRODUCTS.md">All downloads and checksums</a></p>


---

CastLink is a self-hosted studio for bringing remote guests, presentations, and separate audio/video feeds into OBS or vMix. Hosts and guests can use a browser; a dedicated Windows client is also available. This repository contains the application source, build tools, releases, and developer documentation.

## Download and install

Choose a package from the [product catalog](distribution/PRODUCTS.md) or [releases](https://github.com/resokol/castlink/releases). Windows Client, Windows Server Setup, and standalone Linux have independent release tracks. Download each package and its `SHA256SUMS` from the same product release.

| Product | Purpose |
| --- | --- |
| Windows Client | Join a studio as a guest or host. Install using `setup.exe`; Docker is not required. |
| Windows Server Setup | Install your server on Windows or on Linux Ubuntu over SSH. Extract all of `CastLink-Windows.zip` and run `EasySetup.exe`. |
| Linux Ubuntu | Install a server directly on Linux. The [Linux manual](distribution/LINUX_MANUAL.md) covers quick and advanced setup. |

[Installation: Русский / English / 简体中文](distribution/INSTALL.md) · [User documentation](distribution/README.md) · [Remote PC control (Russian)](docs/REMOTE_PC_CONTROL_RU.md).

[resokol/castlink](https://github.com/resokol/castlink) is the canonical public repository for MIT-licensed source, releases, and instructions. Release archives and checksums are publicly accessible. The former `resokol/castlink-releases` address redirects here to preserve existing download and installer links. The single GitHub `releases/latest` entry does not select the latest release of all three products; use the product catalog.

Existing archives and SHA256 hashes are preserved without rebuilding. Their manifests or update checks may still use the former repository name; GitHub redirects it to this repository. For manual installation, choose the exact release listed in the catalog.

A Windows server requires Docker Desktop with Linux containers. VPS installation supports Ubuntu 22.04/24.04 amd64. You run the server on your own infrastructure. See the installation guides for networking, HTTPS, ports, and updates.

## Development

Install Git, Node.js 22, and pnpm 9.15.0. Dependency versions are pinned in `pnpm-lock.yaml`.

```sh
git clone https://github.com/resokol/castlink.git
cd castlink
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:ci
pnpm build
```

Run `pnpm dev` to start the web development server. A complete local environment also needs LiveKit, access configuration, and a configured storage backend. Use a separate development environment and database. Configuration templates are in `infrastructure/`; do not use production data for tests.

| Directory | Contents |
| --- | --- |
| [apps/web](apps/web) | Next.js/React, server APIs, and browser interfaces |
| [apps/desktop](apps/desktop) | Windows client and native integrations |
| [apps/cli](apps/cli) | Legacy CLI, distinct from the standalone Linux installer |
| [native](native) | Native Windows components and protocols |
| [scripts](scripts) | Builds, installers, migrations, and checks |
| [infrastructure](infrastructure) | Compose, SQL, service templates, and runtime components |
| [docs](docs/README.md) | Architecture, development, and operations |
| [distribution](distribution) | User instructions and release tracks |

Start with the [learning manual](docs/MANUAL_RU.md), [project guide](docs/PROJECT_GUIDE_RU.md), and [technical invariants](docs/CRITICAL_INVARIANTS_RU.md) (Russian). For UI work, see the [design system](DESIGN.md) and [UI guide](docs/UI_EDITING_GUIDE_RU.md). Updating a source checkout does not automatically update an installed application or server. Some detailed documentation is currently available only in Russian; installation instructions include English and Simplified Chinese.

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for changes and validation, and [SECURITY](SECURITY.md) for privately reporting vulnerabilities.

## License

CastLink’s own source code is available under the [MIT License](LICENSE), permitting use, modification, and redistribution with the copyright and permission notice retained. Third-party components retain their respective licenses and notices: [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).

Previously released Client `f6c47a27a62c` and Server Setup/Linux `d703726cd50b` packages retain their included CastLink Freeware Distribution License 1.1. Their archives and SHA256 hashes are unchanged; the current source license does not replace the license embedded in those packages.

Author: [Telegram @sklvmax](https://t.me/sklvmax) · [GitHub resokol](https://github.com/resokol).
