[Русский](../../CHANGELOG.md) · **English** · [简体中文](../zh-CN/CHANGELOG.md)

# CastLink changelog

These notes apply to the ready-to-use packages of the listed releases. New features appear here after a build is published.

## 22 October 2026 · Server Setup / Linux · 1.0.0-rc.8-72b315b2d251

Fixed the guest card and room outbound bitrate display, exposure/contrast, output transparency and SVG emoticons. This updates self-hosted servers; Windows Client remains on its previous release. Update outside a broadcast.

## 21 October 2026 · Client / Server Setup / Linux · 1.0.0-rc.8-90135013f5b6

- Portrait mobile Tiles uses two 16:9 columns; long lists scroll while video nodes remain mounted.
- Share presentation opens compact controls immediately. An available native Windows panel takes priority; unsupported or denied browser popouts leave controls on the page. Closing controls does not stop media.
- Added 24 emoticons and seven temporary reactions. Reactions appear in the room for two seconds, respect reduced motion and stay out of chat and clean outputs. Emoticon history and export keep Unicode.
- Studio sections, five guest cards in wide windows and four settings in a 2×2 grid fit more compactly; adjacent buttons and selects have consistent sizing.
- Reopening the same invitation retains its assigned slot with a valid saved signed credential. A second tab cannot erase the first tab’s session; scope, generation and SID remain checked.
- Server and Client release separately. Update outside a broadcast using the package and checksums from one track. Client installation is available through F10 → Check for updates, or manually; versions without that command need a manual update. EXEs are unsigned.
- Real SFU, physical devices, installed Windows GUI and exclusive fullscreen PowerPoint were not verified for these changes. And other minor changes.

## 21 October 2026 · Client / Server Setup / Linux · 1.0.0-rc.8-cb8a387b959f

- Fixed black camera/screen outputs for assigned slots: the output now receives its permitted subscription. Signed-link, assignment and read-only permission checks remain.
- New studios request H.264 / 10,000 kbit/s / 60 FPS; casters without a saved codec choice use H.264. VP9 is available where supported; saved settings and caster bitrate/FPS are not increased.
- Desktop Windows layout now has a vertical separator with the main camera too. Guest scrolling, source proportions and mobile layout remain.
- Image fields are compact and the duplicate rotation control is removed. Guest cards follow invitations, studio devices collapse, and device diagnostics refresh on late entry, reconnect and device changes.
- A room owner can disconnect that room's administrator/moderator; re-entry remains possible. Other rooms and the primary studio remain protected.
- Control labels and orange accents are clearer. Direct open-PowerPoint controls have been removed from the menu; PDF/PPTX upload and screen sharing remain.
- Update both server and Client. The new native panel label needs a new EXE: F10 → Check for updates, or install manually. EXEs are unsigned; update outside a broadcast and save needed data yourself.
- Physical devices, PowerPoint, vMix and a full broadcast were not separately verified. And other minor changes.

## 21 October 2026 · Server Setup / Linux · 1.0.0-rc.8-b451caba163e

- Fixed persistent camera/screen outputs: a valid signed link works without a studio cookie, including a separate vMix browser source. Access and revocation checks remain.
- The Windows layout keeps large 16:9 desktop thumbnails; the main frame stays fixed while the guest rail scrolls separately. Mobile has compact controls and More, without a resize separator.
- Screen sharing uses a mint button and co-presentation a blue button; the compact presentation panel and guest cards have been updated.
- Update your own server with a verified Server Setup or Linux package outside a broadcast. Windows Client `92085508d54c` works with the new server; these changes do not require replacing its EXE. Refresh pages manually outside a broadcast.
- Physical devices, PowerPoint, vMix and live playback were not separately verified. And other minor changes.

## 21 October 2026 · 1.0.0-rc.8 · 92085508d54c

- Added separate client and managed-server update notifications, manual checks and an option to disable automatic checks. Downloads are SHA256-verified; client installation requires separate consent. Older clients need a one-time manual replacement.
- The Linux helper can check its public update channel. Successful updates clean only owned unused images and temporary downloads; no automatic end-user data backups are created.
- Added responsive Speaker/Tiles caster views that preserve source proportions. Presentation owners can navigate alongside one delegate; competing stale commands are rejected.
- PDF/PPTX files may be up to 1,500,000,000 bytes each with the updated server and converter (2 GiB memory, at least 8 GB free working disk). Fixed permanent camera/screen outputs on older vMix CEF engines.

Update the required tracks from [PRODUCTS](PRODUCTS.md); large presentations need the full server package with the new converter. EXEs are unsigned. Installation and restart require consent; finish broadcasts and save needed data yourself first. The file-size limit does not guarantee every document or physical device.

## 21.10.2026 · Windows Server Setup 1.0.0-rc.8 · 380c06fe0ee1

Fixed: a new local installation no longer adopts an obsolete test draft using 127.0.0.1. Quick and advanced modes ask before continuing an unfinished installation, and successful removal clears continuation for the selected installation. Fixed Windows PowerShell 5 JSON-array parsing so the wizard selects the current independent Windows Server Setup release.

Download the new CastLink-Windows.zip and extract it into a separate folder. Run EasySetup.exe and use a LAN or public IPv4 for a new installation. For VPS removal choose “Remove server” → “Remote server”; SSH discovery does not require a local wizard folder. Do not delete existing server data to update the wizard. Back up the server and end active connections before a server update. EXEs are unsigned; a full installation and physical-device broadcast were not tested here.

[Windows Server Setup](https://github.com/resokol/castlink-releases/releases/tag/server-setup-v1.0.0-rc.8-380c06fe0ee1)

## 20.10.2026 · 1.0.0-rc.8 · bdfe91a92b6b

- Updated the Windows server wizard and the multipage Windows Client installer with a folder selection step. The remote server option is named “On Linux Ubuntu”; quick setup is the default and advanced settings are selected explicitly.
- Website downloads are ordered Windows Client, Windows Server, Linux Ubuntu. The Ubuntu block highlights a manual covering out-of-box and advanced installation, with a link to recent release notes.
- Fixed caster name synchronization during reconnection and session renewal. Caster video fits the available area while retaining its aspect ratio.
- Windows Client, Windows Server Setup and Linux now have separate release tracks, versions and assets.

Back up your own server and end active connections before updating. Update Windows Client manually: fully close the old client and install the new EXE. EXEs do not update themselves and are unsigned. Refresh pages manually outside a broadcast. Physical PowerPoint, devices and a complete broadcast have not been tested separately.

**[CastLink packages](PRODUCTS.md)** · [Installation manual](LINUX_MANUAL.md)

## 20.10.2026 · 1472cd052d7e · Caster workspace and control-window fixes

- Native Windows panels follow the selected CastLink theme; the screen-source picker supports light and dark themes.
- The caster gallery uses available width, chat is 15% narrower and controls are centered. Studio-only viewing retains a local camera preview. Fullscreen tiles hide controls while idle.
- Staff can delete a standalone invitation before it is attached to a slot; linked permanent outputs remain available.
- An absent microphone profile defaults to original audio without noise suppression or echo cancellation. Explicitly saved speech profiles are retained.
- Multiview crop masks source edges without moving, rescaling or changing source proportions.
- The browser floating panel has a Compact size button. Click it if the browser restores an enlarged window; the shared size accounts for the independent STOP area. The browser can still choose its own initial geometry.

Update the server and Windows client. Fully close the old client before launching the new EXE; the EXE does not update itself. Refresh pages manually outside a broadcast. Back up your own server and end active connections before updating. EXEs are unsigned. Physical PowerPoint, devices and a complete broadcast have not been tested separately.

The isolated PPTX converter, existing limits and server permissions are preserved. And other minor changes.

## 20.10.2026 — Combined release: PPTX, slots and Windows controls · 063e4967c05b

[easy-setup-063e4967c05b](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-063e4967c05b) · `1.0.0-rc.3-063e4967c05b`

### Added and changed

- Standard PPTX files are converted to PDF by an isolated converter, with broader support for SVG, fonts, charts and links. PDF files use the existing viewer.
- Caster slots use compact rows with status, counts and quick copying of camera, screen and invitation links.

### Fixed

- A valid PPTX is no longer rejected because it contains a normal vector image. Corrupt-file, password, busy and unavailable-converter errors are distinguished.
- The Windows presentation-control menu leaves STOP accessible; stop errors are fully visible and can be retried.
- And other minor changes.

### Update

Update both the server and Windows client to this combined release. Fully close the old CastLink before launching the new EXE; the EXE does not update itself. Refresh pages manually outside a broadcast. Back up your own server and end connections before updating it.

PDF/PPTX playback is static. Animation, video and password-protected documents are not guaranteed in this mode; layout can differ when original fonts are unavailable. The EXE is unsigned. The additional third-party source archives are provided for license compliance and are not required for normal use.

## 20.10.2026 — New entry, website panels and PR60/PR61 camera settings · 1de5b686d719

PR61 is included: a minimal Studio / Caster entry and a name/device check before explicit connection. Invitations offer the Windows app or browser; the new client registers castlink: and requests confirmation before replacing an active room. Guests do not need a studio access token; server-side invitation and guest access checks remain in force.

Drag slide-control panels by their headers within the page. In supported Chrome/Edge, “Above other windows” opens Document Picture-in-Picture; if unavailable or denied, controls remain in the page. STOP and slides occupy independent areas of the shared window. Closing a panel does not stop sharing.

PR60 is included: the studio, room administrator and moderator set camera dimensions and FPS on the guest card. Server settings take priority; quick 720/1080 and default1080 remain available. Actual dimensions depend on the device/browser. This setting does not enable an off camera or change microphone/screen sharing.

The design, presentations, native Windows panels, high-quality OBS/vMix outputs and new Windows/Linux installers are retained. Download and launch the new client manually after fully closing the old client; automatic EXE self-update is not included. Reload website pages outside a broadcast. Physical PowerPoint fullscreen/focus behavior has not been tested; move the browser PiP window by its frame.

Back up your server and end active connections before updating it. EXEs are unsigned. Optional third-party source archives serve license compliance and are not needed for normal operation.

And other minor changes.

## 20.10.2026 — Camera and browser outputs · 3095e8d34d49

The studio, room administrator or moderator can select a caster camera target of 720/1080. The default request is 1080; actual dimensions depend on the camera and browser and are displayed separately. The setting applies to the current camera and survives reconnection.

OBS/vMix browser outputs request the highest available source layer and retain camera zoom, pan, rotation, crop and mirroring. Screen sharing remains a separate source. This release retains the unified design, presentations, Windows client and new Windows/Linux installers.

Outside a broadcast, reload the studio, caster and vMix browser input pages. This web fix does not require a new EXE; refreshed client packages are included. Back up the server and end active connections before updating it.

And other minor changes.

## 20.10.2026 — Unified client and server release · 6080fa8e3ab1

Updated caster/chat layouts, complete-frame fitting, embedded PPTX fonts, streaming uploads and remote slide navigation. Quick/advanced setup, proxy modes and the standalone Linux helper are retained. Room-creation password settings are available separately.

The client connects to an existing server and supports presentations with separate floating owner/recipient controls. Fully exit the old client before starting the new one. EXE self-update is not implemented; the server update action opens the server installation wizard.

For the server, use CastLink-Windows.zip or CastLink-Linux.tar.gz. Connected-VPS update changes only web and cannot update the coordinator server itself. The Linux helper updates only its own installations. Finish the broadcast and back up before server maintenance.

CastLink-ThirdParty-Sources.tar.gz and CastLink-ThirdParty-Office-Sources.tar.gz are optional source archives and are not required to install. The Windows client is unsigned; Each release has SHA256SUMS for its own files.

And other minor changes.

## [Quick/Advanced setup and standalone Linux helper](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-31a402442fe1) · 2026-10-20

### Added and changed

- Windows Easy Setup offers Quick and Advanced: direct HTTPS, HTTP or an external HTTPS proxy, separate website/media addresses and ports, and an explicit trusted-proxy list. The wizard and controls support RU/EN/简体中文.
- New standalone Linux helper: `init`, `validate`, `start`, `status`, `backup`, `update`. Persistent `--state-dir` retains state, secrets, UUID, network and volume names.
- Fixed packaging of Linux scripts built on Windows so executable programs retain Unix line endings.

### Updating and limitations

Back up data and configuration and update outside broadcasts: services and media are interrupted. The Windows wizard updates the selected existing installation; the Linux helper uses the existing `--state-dir` and makes a consistent backup before switching. It does not adopt Windows/legacy installations. There is no automatic database rollback.

For standard media retain TCP 7881, UDP 7882, UDP 3478 and UDP 30000–30031; use configured ports for Advanced. HTTP on a LAN/public IP is not a secure context for camera/microphone/screen sharing. An external proxy needs separate HTTPS and media verification. TURN/TLS remains a direct-public-HTTPS procedure on 80/443 with a separate TURN domain. See [INSTALL](INSTALL.md), [Linux](LINUX_INSTALL.md) and [TURN/TLS](TURN_TLS.md).

## [CastLink 1.0.0-rc.3 · clear chat](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-f56c19e3e0fa) · 2026-10-19

### Added

- Studio, administrator, and moderator chat now includes a “Clear chat” button. Confirming “Clear for everyone” deletes messages for everyone in the room, including casters, and removes the saved history. This cannot be undone. Casters cannot clear the shared chat.
- Delayed history loads and old messages do not restore deleted conversations. Messages sent after clearing are retained.

### Updating

Back up data and configuration, then update the existing installation with the new Easy Setup package off air: the installer recreates LiveKit and interrupts current media connections. After updating, reload all previously open studio, administrator, moderator, and caster tabs: old tabs do not receive the new clearing behavior automatically. Test clearing chat and sending new messages.

## [CastLink 1.0.0-rc.3 · caster chat](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-cf85a7d17ee5) · 2026-10-19

### Fixed

- Fixed the caster chat window growing with long conversations. Messages scroll inside the window while the input field and Send button remain visible on desktop and mobile.

### Updating

Back up data and configuration, then update the existing installation with the new Easy Setup package off air: the installer recreates LiveKit and interrupts current media connections. Open the updated interface and test scrolling and sending messages in caster chat.

## [CastLink 1.0.0-rc.3 · build 776AF9 · chat history and broadcast controls](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-2c6a08388ae4) · 2026-10-19

- Room chat is stored on the server for the last 24 hours and restored when reopened. Loading existing history does not increase the unread count. Statistics includes “Download chat · 24 hours”, which saves messages from that period as a UTF-8 text file.
- Administrator and moderator panels group the name, microphone, and speakers at the top, with Whisper available on the relevant caster card. Cards keep a compact 313 px width, fitting five per row when space allows.
- A red floating STOP SHARING panel is available during screen sharing in supported Chrome and Edge versions. After a source is selected, the browser attempts to open it automatically; if it does not appear, click “Show stop-sharing panel”. Closing the panel only hides it; ending screen sharing closes it.
- Download links display the CastLink product version and build number while retaining exact package links for the selected release.
- And other minor changes.

The panel uses browser features. Availability, minimum window size, and automatic opening depend on the browser; excluding the panel from captured video is not guaranteed. Test your chosen capture mode before broadcasting. If floating windows are unavailable, stop sharing with the normal CastLink button.

### Updating

Back up data and configuration, then update the existing installation with the new Easy Setup package off air: the installer recreates LiveKit and interrupts current media connections. Open the updated interface and test chat, history downloads, and screen-sharing controls on your own devices.

## [CastLink 1.0.0-rc.3 · build 776AF9 · studio chat](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-ff5ab45d4041) · 2026-10-18

- Studio, administrator, and moderator chat now has a separate tab in the left sidebar. While the tab is closed, its badge counts new incoming messages; opening chat clears the unread count.
- Chat includes a personal “Show unread message counts” checkbox. It is on by default; your choice is saved in this browser and does not change settings for other participants or the server. Caster chat keeps its existing behavior.

### Updating

Back up data and configuration, then update the existing installation with the new Easy Setup package. Update off air: the installer recreates LiveKit and interrupts current media connections. Then open the updated interface and test chat with participants.

## [CastLink 1.0.0-rc.3 · build 776AF9](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-451694566045) · 2026-10-18

### Added and fixed

- Permanent participant slots: the studio, administrator, or moderator creates a slot, associates an invitation with it, and assigns a connected caster. Separate camera-with-audio and screen-with-audio outputs can be added to OBS/vMix in advance.
- Renaming a slot, changing its invitation, or assigning another caster preserves its output URLs. Reissuing a link is a separate action; deleting the slot makes its output unavailable.
- Casters enter rooms normally without waiting for moderator admission. Slot assignment controls permanent outputs and is not a prerequisite for entry; replacing or clearing an assignment does not disconnect the caster.
- Administrator and moderator invitations are again issued from room settings in the studio under the existing permissions. No separate server-owner login or new password is required; these roles remain room-scoped.
- The device-check screen requests and starts the camera and microphone before joining, subject to invitation settings and browser permissions. Denying one device does not block testing the other; granting permission refreshes the device list.
- Fixed recovery of the same guest session after a brief interruption and retention of its settings when renewing the connection. Revoked invitations cannot be used for a fresh entry, and explicitly removed participants cannot bypass access restrictions by reconnecting.
- The multiview editor now has a visual grid for arranging cells: toggle it on or off and adjust the spacing from coarse to fine. The grid appears only in the editor and is absent from the published output.
- Retained experimental multiview with grids and free layouts, 16:9/4:3 scenes, independent slot aspect ratios, import/export and transparent output, new-invitation defaults, caster framing, and the backup-server section.
- And other minor changes.

### Updating and limitations

Update the existing installation with the new Easy Setup package after backing up data and configuration. Schedule an off-air window: the installer recreates LiveKit and interrupts current media connections. Updating preserves rooms and data; PostgreSQL and JSON storage are supported, and the slot schema is added without deleting existing records. Historical compatibility migrations remain in place; do not roll back by deleting database tables. When upgrading from a build older than f120f6, first follow the port requirements below. The studio’s web-only updater does not change these ports.

Update any backup server you use to a compatible version, prepare it again, and test transfer. Reopen the interface off air after updating and test invitations, reconnection, and permanent outputs with your own devices and OBS/vMix. Automated and browser checks do not replace this test: compatibility with every physical camera, phone, and receiving application is not claimed. Multiview remains experimental; presentations are temporarily disabled, and initial echo is still under investigation.

## [CastLink 1.0.0-rc.2 · 69b4e4](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-69b4e433d1f1) · 2026-10-18

### Changed and fixed

- **Room administrator and moderator invitations** are restored. A connected caster can accept or decline a role offer in their own tab. Accepting stops the guest camera, microphone, and screen sharing, then opens the staff panel **in the same tab**.
- Only a **room administrator or moderator** can start private talkback with a caster. Private talkback controls are removed from the primary studio.
- Caster replies use **hold to talk**: only while the caster holds Hold to reply privately is their microphone excluded from the program and heard by the private counterpart. Releasing restores the previous microphone state unless it was separately muted in the meantime. The studio microphone, program, screen sharing, and other participants’ audio continue unchanged.
- If the private reply cannot end safely, the caster microphone **stays muted in the program**. The interface reports an error; it does not resume automatically. Check the state and enable the microphone manually.
- **Presentations are temporarily disabled.** Opening PDFs, delegating page control, connecting PowerPoint, and downloading helpers are unavailable. PowerPoint operation is not claimed. Normal screen sharing remains a separate feature.
- And other minor changes.

### Limitations and updating

Release 12d6f6 is withdrawn; use its replacement. The initial-connection echo issue remains unresolved. Yandex Browser on macOS and Wirecast compatibility tests remain deferred; this release does not establish that they work.

Download the new package, verify SHA256SUMS, and update the existing installation through Easy Setup. Reopen studio, administrator, moderator, and caster pages while off air. Test invitations and private replies before broadcasting. After updating a backup server you use, prepare it again and test transfer. Upgrading from a build older than f120f6 requires the media port changes below; the studio’s web-only updater does not change those ports.

## CastLink 1.0.0-rc.2 · 12d6f6 — withdrawn · 2026-10-18

This build has been withdrawn and replaced by the following release. Its earlier presentation instructions and private talkback behavior no longer describe the current version; use the replacement release notes above.

## [CastLink 1.0.0-rc.2 · fd0ff3](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-fd0ff31a697a) · 2026-10-18

### Added and changed

- **4:3 (1440×1080)** Multiview scene format.
- Each slot can use its own format: **Source, 16:9, or 4:3**. Free layouts preserve the selected ratio when resizing; grid layouts fit the frame inside its cell. The choice is saved with the scene and preserved on export/import. Contain and Fill control the image inside the frame.
- And other minor changes.

### Updating

Select Update for the existing installation in the new Easy Setup. After updating, reload the studio page while off air. Rooms, settings, and scenes are preserved; existing slots retain their previous Source mode. If upgrading from a build older than f120f6, first follow the port requirements in the release notes below.

## [CastLink 1.0.0-rc.2 · 3f2275](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-3f227587f8d2) · 2026-10-17

### Fixed

- Switching to Multiview, Participants, Statistics, or Backup Servers no longer stops the studio's screen sharing or its audio. The stop button and cleanup when leaving the studio still work.
- All features and the reduced port mappings from build f120f6 are retained.

### Updating

Select Update for the existing installation in the new Easy Setup. After updating, reload the studio page while off air. Rooms and settings are preserved. If upgrading from a build older than f120f6, first follow the port requirements in the release notes below.

## [CastLink 1.0.0-rc.2 · f120f6](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-f120f6442145) · 2026-10-17

### Added and changed

- The studio now has an experimental Multiview editor: grids and free layouts, movable and resizable slots, snapping guides, individual framing, rounded corners, and a shared placeholder when video is absent. Scenes can be duplicated, deleted, exported, and imported. Assign sources again after importing. A separate output link provides a transparent background for OBS/vMix Browser Source; publish scene changes with Apply.
- Customize room lets you set defaults for new invitations: join with the microphone off, audio only without enabling the camera on entry, and prevent casters from hearing each other. Saving settings does not change existing invitation links or connected sessions; issue new invitations.
- Caster framing in the studio changes immediately and saves automatically. Zoom, position, rotation, mirroring, and crop have sliders and precise number inputs in a compact panel near the video. These adjustments affect display in the studio and individual video output; the caster's source stream is not re-encoded. Multiview slots have their own settings.
- Studio Return supports a black background instead of a camera. Muting the output also mutes `/watch` and screen sharing; the audio meter reflects that mute. Personal monitoring remains separate.
- Room transfer, emergency backup, and room servers are grouped under Backup servers in the sidebar.
- And other minor changes.

### Fixed

- Fixed new casters joining after a room transfer between servers.
- Free-layout multiview slots preserve source proportions when resized. Video and placeholders are clipped at scene boundaries; rounded corners match in the editor and output.
- Easy Setup now publishes fewer Docker UDP ports. The previous wide ranges could start thousands of Docker forwarding processes, exhaust server memory, and make the website unavailable with a 502 error.

### Updating an existing server

1. Before updating, allow **UDP 7882** in your provider's network firewall and the server firewall. If the server is behind a router, forward this port too. Keep **TCP 80/443/7881**, **UDP 3478**, and allow **UDP 30000–30031**. Keep your SSH port accessible. Optional TURN/TLS uses **TCP 443** and a separate TURN domain.
2. Back up your data and configuration. Fully extract the new Windows package, run `EasySetup.exe`, choose Update, and select the existing installation: the same local folder or VPS. The manual Linux guide remains pinned to the earlier `easy-setup-8b02e2d4dc3c` release: do not replace its tag or checksums with `latest`. To migrate a VPS to the new Easy Setup layout, use the new Windows wizard over SSH.
3. Update between broadcasts: the installer recreates the LiveKit container to apply the media ports, interrupting active media connections. Updating the existing installation preserves its data; deleting the installation or data volumes is unnecessary.
4. After updating, check the website, a new caster connection, audio and video, individual output, `/watch`, and your configured backup from the networks you use. Open the updated browser interface.

The new Easy Setup layout uses **UDP 7882 / TCP 7881** for direct media, **UDP 3478** for TURN, and **UDP 30000–30031** for TURN relay. It replaces the former **UDP 61000–61100** media range and **UDP 30000–30999** relay range. External firewall rules and router forwarding are configured separately from Docker; downloading the new ZIP alone does not update the server.

The **Update button for a backup server inside the studio updates only the web application**. It does not recreate LiveKit or migrate an existing installation to the new media ports. Use the new installer to make this transition. Check custom installations against their actual configuration.

### Multiview limitations

Multiview remains experimental: up to 16 scenes and 32 slots, with no performance guarantee for every device. Start with a 2×2 grid. Scenes are stored on the current server and are not automatically transferred to a backup; export/import transfers the composition and requires sources to be assigned again. Share output links only with trusted broadcast recipients: a link grants access to room media. Browser audio may require a user click. Check your own cameras, network, and receiving software before a live broadcast.


## CastLink 1.0.0-rc.2 · build 8b02e2

### Changed
- The studio caster card is more compact: the microphone level meter sits directly below the video, settings use a grid, and key connection statistics stay visible beside them.
- Settings help and hardware details expand separately. Pending confirmations, errors and device warnings remain visible. The preview preserves the image proportions.

### Updating
Download the new package and verify SHA256SUMS. Update the selected installation with Update. Servers do not update automatically. Reopen the studio page at an agreed time after updating: reloading the primary studio can interrupt a broadcast. Narrow screens and expanded details use vertical scrolling.

[Release files](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-8b02e2d4dc3c)

## CastLink 1.0.0-rc.2 · build 1549d5

### Added and changed
- Casters can select VP8, H.264 or AV1 video. Availability depends on the browser; VP8 remains the default. The interface distinguishes the selected codec from the negotiated codec.
- The studio can request a caster microphone, camera or audio output change. The caster must accept or decline the request. Disabled cameras and microphones retain their state.
- Updated the mint CastLink mark in the browser, control panel and Windows package. The landing support QR image now uses a crisp PNG.

### Updating
Download the new package, verify SHA256SUMS and use Update for the selected installation. Servers do not update automatically. Reopen client pages at a suitable time after updating: reloading the primary studio page may interrupt the broadcast. H.264/AV1 and audio output selection depend on the browser and devices. Verify live camera and microphone operation separately on your installation.

[Release files](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-1549d59e50e2)

## CastLink 1.0.0-rc.2 · build 73feb7

### Fixed
- Backup VPS updates show download, verification, and extraction stages. Reading the manifest no longer requires extracting the entire large archive.
- Clarified messages about automatic backup compatibility and the need to prepare it again after an update.
- Fixed service start and stop timers in the Windows panel.
- Desktop icon updates account for the Windows cache.
- Made package builds more resilient to temporary network errors.

### Added and changed
- You can delete a saved connection to a backup or transfer server. This does not remove CastLink or data on the VPS itself.
- The installer clearly separates “Install,” “Update,” and “Uninstall.”
- Enlarged the installer and panel windows and shortened the displayed build number to six characters.

### Updating
Update your local CastLink and backup server, then prepare the backup again. Test transfers on your own network before broadcasting. Actual audio and video recovery time depends on the network and browsers; these changes do not guarantee a switchover within 60 seconds.

[Release files](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-73feb70deae3)

## CastLink 1.0.0-rc.2 · build 76bb47

### Changed
- After local installation, running services are handed over to the CastLink panel without requiring a stop at the last step.
- Closing the window hides the panel in the system tray and leaves the server running.
- The panel has separate buttons to start and stop services. “Stop and exit” stops the services and closes the panel.
- Launching the installer and panel hides the auxiliary PowerShell window; Docker Desktop starts in the background when supported by the installed version.

### Added
- The application version and build number are displayed in the installer and control panel.

### Updating
Install the package over the existing installation through the wizard. CastLink does not start automatically when you sign in to Windows: use the CastLink shortcut to start it. Stopping services preserves installation data.

Archived release; downloads hidden.

## CastLink 1.0.0-rc.2 · build 6b269d

### Added
- Update a connected VPS from the servers section in the studio panel.
- Checks for server status and maintenance mode before updating.
- Preservation of installation data and verification of the update result; the previous configuration can be restored if an error occurs.

### How to use
First, update CastLink on the computer you use to manage servers. Open “Room servers,” select a server, and click “Update.” Prepare the backup again after completion.

Schedule server updates outside broadcast hours. Updating a particular VPS requires checking its resources, network, and current connections.

Archived release; downloads hidden.

## CastLink 1.0.0-rc.2 · build 81e386

### Added
- Prepare automatic backup for a local server behind NAT: the primary server establishes an outbound connection to the backup.
- Monitor primary server availability and transfer the state of the prepared backup.

### Changed
- Merged changes from the automatic backup test branch into the main release line.
- Unified the application, website, and Windows package icons.

### Before testing
Install a compatible release on both the primary and backup servers, prepare the backup again, and enable automation. Both servers and browsers need internet access. A single caster disconnecting should not transfer the entire room.

The goal of recovery within 60 seconds requires measurement on a real broadcast setup; this release does not establish that guarantee for all networks.

Archived release; downloads hidden.

## CastLink 1.0.0-rc.2 · build 687e80

### Added
- Connect to a VPS using a password or private SSH key in the Windows wizard and backup connection form.
- Generate an SSH key, save the private file with its owner, add the public part to the VPS, and verify the new connection.
- Display the build version next to download links on the website.

### Setup notes
Adding the key initially requires a valid password or key and verification of the server fingerprint. Store the generated private key separately and do not share it with others. Existing VPS login methods are not removed.

Archived release; downloads hidden.
