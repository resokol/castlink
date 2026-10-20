[Русский](../../README.md) · **English** · [简体中文](../zh-CN/README.md)

## 20.10.2026 — New entry, website panels and PR60/PR61 camera settings · 1de5b686d719

PR61 is included: a minimal Studio / Caster entry and a name/device check before explicit connection. Invitations offer the Windows app or browser; the new client registers castlink: and requests confirmation before replacing an active room. Guests do not need a studio access token; server-side invitation and guest access checks remain in force.

Drag slide-control panels by their headers within the page. In supported Chrome/Edge, “Above other windows” opens Document Picture-in-Picture; if unavailable or denied, controls remain in the page. STOP and slides occupy independent areas of the shared window. Closing a panel does not stop sharing.

PR60 is included: the studio, room administrator and moderator set camera dimensions and FPS on the guest card. Server settings take priority; quick 720/1080 and default1080 remain available. Actual dimensions depend on the device/browser. This setting does not enable an off camera or change microphone/screen sharing.

The design, presentations, native Windows panels, high-quality OBS/vMix outputs and new Windows/Linux installers are retained. Download and launch the new client manually after fully closing the old client; automatic EXE self-update is not included. Reload website pages outside a broadcast. Physical PowerPoint fullscreen/focus behavior has not been tested; move the browser PiP window by its frame.

Back up your server and end active connections before updating it. EXEs are unsigned. Optional third-party source archives serve license compliance and are not needed for normal operation.

And other minor changes.

## 20.10.2026 — Camera and browser outputs · 1de5b686d719

The studio, room administrator or moderator can select a caster camera target of 720/1080. The default request is 1080; actual dimensions depend on the camera and browser and are displayed separately. The setting applies to the current camera and survives reconnection.

OBS/vMix browser outputs request the highest available source layer and retain camera zoom, pan, rotation, crop and mirroring. Screen sharing remains a separate source. This release retains the unified design, presentations, Windows client and new Windows/Linux installers.

Outside a broadcast, reload the studio, caster and vMix browser input pages. This web fix does not require a new EXE; refreshed client packages are included. Back up the server and end active connections before updating it.

And other minor changes.

<p align="center">
  <a href="https://castlink.ru"><img src="../../assets/castlink-logo.svg" width="112" height="112" alt="CastLink logo"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>CastLink 1.0.0-rc.3 · build 776AF9</strong></p>
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

- Room chat history for the last 24 hours, restored on return and downloadable as a text file from Statistics. In caster chat, long conversations scroll inside the window while the input field and Send button remain visible.
- A separate studio, administrator, and moderator chat tab with a personal setting for new-message counters and confirmed clearing of the whole room’s history.
- Permanent slot outputs for OBS/vMix, normal caster entry, and automatic camera and microphone checks before joining.
- Experimental multiview with a separate transparent output for OBS/vMix.
- Defaults for new invitations and automatically saved caster framing.
- A dedicated Backup servers section in the studio sidebar.
- A compact caster card with microphone level and key connection statistics.
- VP8, H.264 or AV1 caster video selection, where supported by the browser.
- Studio requests to change devices, with caster confirmation.
- Separate video and audio streams for each caster.
- Watch the studio broadcast through a `/watch` link.
- Manual room transfer and configurable automatic backup.
- Connection statistics for network diagnostics.
- Interface in Russian, English, and Simplified Chinese.

**Public testing is in progress.** Before a live broadcast, test devices, networking, and backup on your own equipment.

## Windows client and unified release

This release combines the current server, the new Linux installer and the separate Windows client.

[Install the client](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1de5b686d719/CastLink-Client-1.0.0-rc.3-1de5b686d719-setup.exe) · [Portable client](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1de5b686d719/CastLink-1.0.0-rc.3-1de5b686d719-Windows.exe)

The client connects to an existing server and supports presentations with separate floating owner/recipient controls. Fully exit the old client before starting the new one. EXE self-update is not implemented; the server update action opens the server installation wizard.

Updated caster/chat layouts, complete-frame fitting, embedded PPTX fonts, streaming uploads and remote slide navigation. Quick/advanced setup, proxy modes and the standalone Linux helper are retained. Room-creation password settings are available separately.

For the server, use CastLink-Windows.zip or CastLink-Linux.tar.gz. Connected-VPS update changes only web and cannot update the coordinator server itself. The Linux helper updates only its own installations. Finish the broadcast and back up before server maintenance.

CastLink-ThirdParty-Sources.tar.gz and CastLink-ThirdParty-Office-Sources.tar.gz are optional source archives and are not required to install. The Windows client is unsigned; SHA256SUMS covers all downloads.

## New installer: quick setup or your own network

Release [easy-setup-31a402442fe1](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-31a402442fe1) adds **Quick / Advanced** setup. Quick keeps the usual HTTPS configuration; Advanced offers HTTP, direct HTTPS or an external HTTPS proxy, with separate website and media addresses and ports. The wizard and standalone Linux helper support RU / EN / 简体中文.

Linux can now be installed without Windows: `scripts/linux-compose-setup.py` provides `init`, `start`, `status`, `backup` and `update`, retaining a separate configuration directory, UUID, secrets and volume names. It manages its own installations and does not adopt Windows or legacy deployments.

[Modes, reverse proxies and backups](INSTALL.md) · [New Linux helper and separate legacy instructions](LINUX_INSTALL.md). Plain HTTP on a LAN/public IP does not provide the secure browser context needed for camera, microphone and screen sharing; use trusted HTTPS for remote participants. A website proxy does not replace media ports.

## Download

| Platform | Package | Guide |
| --- | --- | --- |
| Windows 10/11 x64 | [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip) | [Installation and operation](GUIDE.md#install-on-windows) |
| Ubuntu 22.04/24.04 amd64 | [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz) | [Install directly on Linux](LINUX_INSTALL.md) |

[Latest release](https://github.com/resokol/castlink-releases/releases/latest) · [Changes](CHANGELOG.md) · [Checksums](https://github.com/resokol/castlink-releases/releases/latest/download/SHA256SUMS)

**Before updating a standard installation:** allow UDP 7882 at your provider, in the firewall, and on your router; keep TCP 80/443/7881, UDP 3478, and UDP 30000–30031. The new installer recreates LiveKit and interrupts media while preserving data. The backup update button in the studio changes only web and does not migrate ports. [Update instructions](GUIDE.md).

Download the package and `SHA256SUMS` from the same release. Use the [current section](LINUX_INSTALL.md) for the new standalone Linux helper; the older pinned 8b02 procedure remains separately marked as legacy. A macOS package has not been published yet.

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
