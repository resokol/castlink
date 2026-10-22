[Русский](../../README.md) · **English** · [简体中文](../zh-CN/README.md)

<p align="center">
  <a href="https://castlink.ru"><img src="../../assets/castlink-logo.svg" width="112" height="112" alt="CastLink logo"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>CastLink 1.0.0-rc.8</strong></p>
<p align="center"><strong>Remote casters. Separate sources. Your broadcast.</strong></p>
<p align="center">Connect through a browser · OBS and vMix · Your own server</p>
<p align="center">
  <a href="https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/CastLink-Windows.zip"><strong>Download for Windows</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/CastLink-Linux.tar.gz"><strong>Download for Linux</strong></a>
</p>
<p align="center">
  <a href="https://castlink.ru">Website</a> &nbsp; / &nbsp;
  <a href="GUIDE.md">Guide</a> &nbsp; / &nbsp;
  <a href="CHANGELOG.md">What's new</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax">Contact the author</a> &nbsp; / &nbsp;
  <a href="SUPPORT.md"><strong>♡ Support CastLink</strong></a>
</p>

---

Windows Client is **1.0.0-rc.8**, build `90135013f5b6`; Windows Server and Linux Ubuntu are **1.0.0-rc.8**, build `72b315b2d251`: [packages and checksums](PRODUCTS.md). Get the package and `SHA256SUMS` from the same track and release.

Portrait mobile Tiles uses two 16:9 columns. Chat offers 24 emoticons while history and export keep ordinary Unicode. Reactions offers seven two-second animations with reduced-motion support; reactions are not added to chat or clean outputs.

Reopening the same invitation restores its slot when a valid signed session remains saved. A second tab is isolated; its denied entry does not erase the first tab’s session. Expired or revoked permission is not restored.

The studio layout is more compact: playback and invitations are on the left, outbound stream and transport on the right. Wide windows fit five guest cards and four equal settings in a 2×2 grid below the graph. Narrow windows retain sequential sections.

Windows EXEs are unsigned. Updates require user consent and may restart the app or services; schedule a broadcast pause and save the data you need yourself. End-user servers create no automatic backups. Test physical devices, PowerPoint and your documents before going live.

A free system for remote broadcast connections. A caster (a remote contributor) opens a link in a browser, and the studio receives their video and audio as a separate source for OBS, vMix, or other production software. The server runs on your Windows PC or Linux VPS.

- Room chat history for the last 24 hours, restored on return and downloadable as a text file from Statistics. In caster chat, long conversations scroll inside the window while the input field and Send button remain visible.
- A separate studio, administrator, and moderator chat tab with a personal setting for new-message counters and confirmed clearing of the whole room’s history.
- Permanent slot outputs for OBS/vMix, normal caster entry, and automatic camera and microphone checks before joining.
- Experimental multiview with a separate transparent output for OBS/vMix.
- Defaults for new invitations and automatically saved caster framing.
- A dedicated Backup servers section in the studio sidebar.
- A compact caster card with microphone level and key connection statistics.
- VP8, VP9, H.264 and AV1 caster video where supported by the browser.
- Studio requests to change devices, with caster confirmation.
- Separate video and audio streams for each caster.
- Watch the studio broadcast through a `/watch` link.
- Manual room transfer and configurable automatic backup.
- Connection statistics for network diagnostics.
- Interface in Russian, English, and Simplified Chinese.

**Public testing is in progress.** Before a live broadcast, test devices, networking, and backup on your own equipment.


The caster workspace offers Windows (layout) and Tiles views. On desktop, the vertical separator in Windows view resizes the main camera or screen and the right rail. With multiple sources, use the pointer or keyboard. The guest rail scrolls separately and video keeps its proportions. Mobile has no separator; compact controls and More remain. Screen sharing uses a mint button and co-presentation a blue button.

A new studio requests H.264, 10,000 kbit/s and 60 FPS; casters without a saved codec choice use H.264. Explicit saved settings remain unchanged and caster bitrate/FPS are not increased. VP8, VP9, H.264 and AV1 are available where supported; the interface shows the selected and negotiated codec. Requested settings do not guarantee measured quality.
## Windows client and separate server packages

If the native Windows panel still shows the older control label, update Client: F10 → Check for updates, or download the new installer manually. Replace older versions without update checks manually. Updating the server does not replace the EXE; finish your broadcast first. EXEs are unsigned.

Windows Client connects a studio or caster to an existing server. Server Setup and Linux install your own server and are released separately.

[Install the client](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-setup.exe) · [Portable client](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-1.0.0-rc.8-90135013f5b6-Windows.exe) · [Client ZIP](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-win-x64.zip)

The client connects to an existing server and checks the client channel and saved managed servers separately. You can check manually or disable automatic checks. Downloads are SHA256-verified; closing the client and installing a new version require separate consent. Replace older clients without built-in update checks manually; a server update does not replace the client EXE.

Updated caster/chat layouts, complete-frame fitting, embedded PPTX fonts, streaming uploads and remote slide navigation. Quick/advanced setup, proxy modes and the standalone Linux helper are retained. Room-creation password settings are available separately.

Use CastLink-Windows.zip or CastLink-Linux.tar.gz for the server. A saved managed VPS is updated through the Windows wizard with SSH access when needed; a normal connection URL grants no update permission. New presentation features require updating both web and converter through the matching full server package. The Linux helper manages only its own installations. Finish the broadcast before updating.

CastLink-ThirdParty-Sources.tar.gz and CastLink-ThirdParty-Office-Sources.tar.gz are optional source archives and are not required to install. The Windows client is unsigned; Each release has SHA256SUMS for its own files.

## New installer: quick setup or your own network

In rc.8, Quick is the default. Explicitly enable **Advanced setup** in the Windows wizard for technical options; add `--advanced` in the standalone Linux CLI. Quick uses standard HTTPS and ports. Advanced supports HTTP, direct HTTPS or an external HTTPS proxy, plus website and media addresses and ports. The wizard and Linux CLI support RU / EN / 简体中文. See [installation modes and configuration examples](INSTALL.md).

The Linux helper `scripts/linux-compose-setup.py` provides `init`, `start`, `status`, `check-updates` and `update` with the existing `--state-dir`. UUIDs, secrets, networking and volume names persist; Windows/legacy installations are not adopted. The `backup` command is removed; save required data and configuration copies yourself.

[Modes, reverse proxies and backups](INSTALL.md) · [New Linux helper and separate legacy instructions](LINUX_MANUAL.md). Plain HTTP on a LAN/public IP does not provide the secure browser context needed for camera, microphone and screen sharing; use trusted HTTPS for remote participants. A website proxy does not replace media ports.

## Download

| Platform | Package | Guide |
| --- | --- | --- |
| Windows 10/11 x64 | [Windows Client](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/SHA256SUMS) | Windows app: studio and caster |
| Windows 10/11 x64 | [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/SHA256SUMS) | [Installation and operation](GUIDE.md#install-on-windows) |
| Ubuntu 22.04/24.04 amd64 | [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/SHA256SUMS) | [Install directly on Linux](LINUX_MANUAL.md) |

[Release history](https://github.com/resokol/castlink-releases/releases) · [Changes](CHANGELOG.md) · [Checksums by product](PRODUCTS.md)

**Before updating a standard installation:** allow UDP 7882 at your provider, in the firewall, and on your router; keep TCP 80/443/7881, UDP 3478, and UDP 30000–30031. The new installer recreates LiveKit and interrupts media while preserving data. The backup update button in the studio changes only web and does not migrate ports. [Update instructions](GUIDE.md).

Download the package and `SHA256SUMS` from the same release. Use the [current section](LINUX_MANUAL.md) for the new standalone Linux helper; the older pinned 8b02 procedure remains separately marked as legacy. A macOS package has not been published yet.

## Get started

1. Install the server. On Windows, extract the entire archive and run `EasySetup.exe`. For Linux, use the [separate guide](LINUX_MANUAL.md) or [install over SSH from the Windows wizard](GUIDE.md#install-on-a-linux-vps-from-windows).
2. Open CastLink, create a studio, and invite casters using a link.
3. Add the individual caster outputs to OBS/vMix and produce the broadcast in your usual software.

Docker is only needed on the server. Casters only need a browser, HTTPS, and camera/microphone permissions.

## Documentation and help

- [Full guide: devices, networking, backup, and updates](GUIDE.md)
- [Linux without Windows or a graphical wizard](LINUX_MANUAL.md)
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
