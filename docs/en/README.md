[Русский](../../README.md) · **English** · [简体中文](../zh-CN/README.md)

<p align="center">
  <a href="https://castlink.ru"><img src="../../assets/castlink-logo.svg" width="112" height="112" alt="CastLink logo"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>Remote casters. Separate sources. Your broadcast.</strong></p>
<p align="center">Connect through a browser · OBS and vMix · Your own server</p>
<p align="center">
  <a href="https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip"><strong>Download for Windows</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz"><strong>Download for Linux</strong></a>
</p>
<p align="center">
  <a href="https://castlink.ru">Website</a> &nbsp; / &nbsp;
  <a href="GUIDE.md">Guide</a> &nbsp; / &nbsp;
  <a href="CHANGELOG.md">What's new</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax">Contact the author</a> &nbsp; / &nbsp;
  <a href="SUPPORT.md"><strong>♡ Support CastLink</strong></a>
</p>

---

A free system for remote broadcast connections. A caster (a remote contributor) opens a link in a browser, and the studio receives their video and audio as a separate source for OBS, vMix, or other production software. The server runs on your Windows PC or Linux VPS.

- Separate video and audio streams for each caster.
- Watch the studio broadcast through a `/watch` link.
- Manual room transfer and configurable automatic backup.
- Connection statistics for network diagnostics.
- Interface in Russian, English, and Simplified Chinese.

**Public testing is in progress.** Before a live broadcast, test devices, networking, and backup on your own equipment.

## Download

| Platform | Package | Guide |
| --- | --- | --- |
| Windows 10/11 x64 | [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip) | [Installation and operation](GUIDE.md#install-on-windows) |
| Ubuntu 22.04/24.04 amd64 | [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz) | [Install directly on Linux](LINUX_INSTALL.md) |

[Latest release](https://github.com/resokol/castlink-releases/releases/latest) · [Changes](CHANGELOG.md) · [Checksums](https://github.com/resokol/castlink-releases/releases/latest/download/SHA256SUMS)

Download the package and `SHA256SUMS` from the same release. The Linux guide targets a specific build whose package contents have been checked; use the links provided there. A macOS package has not been published yet.

## Get started

1. Install the server. On Windows, extract the entire archive and run `EasySetup.exe`. For Linux, use the [separate guide](LINUX_INSTALL.md) or [install over SSH from the Windows wizard](GUIDE.md#install-on-a-linux-vps-from-windows).
2. Open CastLink, create a studio, and invite casters using a link.
3. Add the individual caster outputs to OBS/vMix and produce the broadcast in your usual software.

Docker is only needed on the server. Casters only need a browser, HTTPS, and camera/microphone permissions.

## Documentation and help

- [Full guide: devices, networking, backup, and updates](GUIDE.md)
- [Linux without Windows or a graphical wizard](LINUX_INSTALL.md)
- [Changelog](CHANGELOG.md)
- [Report a problem to the author](https://t.me/sklvmax)
- [Project website](https://castlink.ru)

When reporting a bug, include the build, OS, browser, time, and steps to reproduce it. Do not share passwords, tokens, or personal access links publicly.

## Support the project

If CastLink helps with your broadcasts, [support its development](SUPPORT.md) through SBP or cryptocurrency. Thank you for your help!

## Author and terms

Author: [@sklvmax on Telegram](https://t.me/sklvmax) · [resokol on GitHub](https://github.com/resokol).

Free to use. Unmodified builds may be redistributed with attribution; modifications require the author's permission. Full terms: [LICENSE](../../LICENSE). Third-party components have their own licenses: [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES).

This repository contains ready-to-use releases and documentation. `CastLink-ThirdParty-Sources.tar.gz` in Assets is provided to comply with the licenses of third-party components; it is not needed for installation. Download the platform package from the table above.


---

[Set up TURN/TLS on TCP 443](TURN_TLS.md)

## Server responsibility

The person or organization deploying and administering a server is responsible for its operation, configuration, security, access control, backups and lawful handling of data and content. Users remain responsible for their own actions and content. Providing CastLink does not, by itself, make the author the host or operator of those servers. Liability that cannot lawfully be excluded remains unaffected.

[Full license terms](../../LICENSE)
