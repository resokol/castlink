[Русский](../../README.md) · **English** · [简体中文](../zh-CN/GUIDE.md)

# CastLink: installation and operation

Choose the [package and checksums for your track](PRODUCTS.md). Windows Client joins an existing server; Windows Server Setup and Linux install a server. Ordinary participants need a supported browser and HTTPS.

[Installation and networking](INSTALL.md) · [Linux without Windows](LINUX_MANUAL.md) · [PDF/PPTX](PRESENTATIONS.md) · [TURN/TLS](TURN_TLS.md) · [Changelog](../../../CHANGELOG.md)

<a id="room-layout"></a>
## Window, Grid, and the participant rail

On a computer, Window mode shows the main source and a narrow participant rail on the right. Drag the vertical divider to resize it; the chosen width is saved. An older saved layout is adjusted once to start with a narrower rail, then your next manual size is retained. The divider works for both camera and screen share, with source proportions preserved. Grid mode arranges sources in tiles. Phones have no resize divider; long rails scroll separately, and portrait Grid uses two 16:9 columns.

<a id="pc-control"></a>
## Screen sharing and PC control

### Ordinary browser sharing

Choose Screen sharing, select a screen, window, or tab offered by the browser, and separately enable available audio. The browser source picker does not automatically launch an application. Audio availability depends on the browser and source. Stop through CastLink or the browser's own sharing indicator.

### Sharing from the Windows client

Select the source and audio in the updated client. A compact native panel shows the source name, status, request menu, and a separate Stop button. Its base size is 400×120; the menu expands when you open it. Drag its heading to move it. A large red window is not a required step in the current flow.

### Requesting, granting, and ending control

The controlled PC must share through the current Windows client. The controller can use a browser or client: open PC control → Request PC control on the relevant video. The owner approves the request in the sharing panel; input is unavailable before consent. The owner can also grant control to a specific participant.

After approval, click the video image to enable input. Permission covers the full PC mouse and keyboard, even when only one window is shared. The owner's local input remains available. Typing into chat and forms does not forward those keys to the remote PC. Use the committed-text field to send completed text; test actual system IME behavior separately.

Reclaim PC control on the owner's side or Finish controlling on the controller's side ends remote input while keeping the share. The separate Stop button ends sharing and input. Closing a menu or hiding a panel does not itself mean Stop. Use the panel buttons as the primary local stop method; physical activation of the additional Ctrl+Alt+Shift+F8 shortcut has not been independently verified. Secure screens and reserved system shortcuts may be unavailable.

### Why input can pause

A controller name and an existing grant do not mean input is currently active. Lost focus, a hidden tab, lost connectivity, changed or unavailable video geometry, or a minimized or unavailable source can stop input and release held keys/buttons. The video share may continue.

Restore a visible source, wait for video and connectivity to recover, release held keys, and click the video again. Do not rely on automatic resumption after a network failure. A revoked or finished grant needs a new request and consent. If input stays paused, check the source on the owner's PC and explicitly restart sharing if needed. In the current build, merely hovering video margins or normally renewing the same grant should not itself pause input.

PDF/PPTX and slide navigation are documented [separately](PRESENTATIONS.md): they have a different scope from full mouse and keyboard access.

## Setup mode and server address

In rc.8, Quick is the default. Explicitly enable **Advanced setup** in the Windows wizard for technical options; add `--advanced` in the standalone Linux CLI. Quick uses standard HTTPS and ports. Advanced supports HTTP, direct HTTPS or an external HTTPS proxy, plus website and media addresses and ports. The wizard and Linux CLI support RU / EN / 简体中文. See [installation modes and configuration examples](INSTALL.md).

When updating, select the existing installation: saved modes, addresses, ports, UUID and secrets are retained. A completed installation's network layout is not changed automatically. Backup servers can be added after quick setup.

In proxy mode the browser uses external HTTPS, while the proxy forwards every path, including `/rtc` and WebSocket, to CastLink's internal Caddy. Trust only the proxy IP/CIDR **seen by Caddy inside Docker**, which may be a gateway address. Do not trust every source. For a proxy on another host, choose a reachable private bind instead of localhost and restrict the firewall. An internal HTTP response does not verify the external HTTPS chain.

Plain HTTP on a LAN/public IP is not a secure context for camera, microphone or screen sharing. Local `localhost` is a browser exception that does not extend to other devices. Use trusted HTTPS: a public certificate or your own CA imported on client devices. Custom ACME ports still need an externally reachable certificate-validation route; see INSTALL.

Default media ports are TCP 7881, UDP 7882, TURN UDP 3478 and UDP 30000–30031. For Advanced, open the ports actually configured. The website proxy does not replace LiveKit/TURN or NAT/firewall setup; web:3000 and PostgreSQL are not published.

The Linux helper `scripts/linux-compose-setup.py` provides `init`, `start`, `status`, `check-updates` and `update` with the existing `--state-dir`. UUIDs, secrets, networking and volume names persist; Windows/legacy installations are not adopted. The `backup` command is removed; save required data and configuration copies yourself. [Linux](LINUX_MANUAL.md).

## Studio chat and message counters

In the studio, administrator panel, or moderator panel, open Chat from the left sidebar. When another tab is selected, the chat badge counts new incoming messages. Opening chat marks them as read and clears the unread count.

Chat includes a personal “Show unread message counts” checkbox. It is on by default; your choice is saved in this browser and does not change settings for other participants or the server.

To delete the conversation, open chat in the studio, administrator panel, or moderator panel, click “Clear chat”, then confirm “Clear for everyone”. This deletes all current messages for everyone in the room, including casters, and the saved server history. This cannot be undone; download chat from Statistics first if you need a copy. Casters cannot clear chat. Delayed history does not restore deleted messages; new messages sent after clearing are retained.

After updating the server, reload all previously open studio, administrator, moderator, and caster tabs off air so everyone receives the new clearing behavior.

Caster chat has a bounded height: long conversations scroll inside the message list while the input field and Send button remain visible on desktop and mobile.

## Permanent slots and caster entry

Create a slot in the studio, name it, and associate it with a caster invitation. The studio, administrator, or moderator can assign a connected caster, replace the assignment, or clear it. Copy the separate permanent camera-with-audio and screen-with-audio links into OBS/vMix. Changing the name, invitation, or assigned caster preserves the output URLs. Only a separate reissue changes a link; deleting the slot makes its output unavailable. These slots are separate from experimental multiview layout slots.

Entering a room does not require slot assignment or separate admission: the caster connects normally. Assignment changes do not disconnect them. Before joining, the device check automatically requests the camera and microphone, subject to invitation settings and browser permissions. If one device is unavailable, the other can be tested independently. The join button still starts the room connection.

Administrator and moderator links are issued from room settings in the studio under the existing permissions. There is no separate server-owner login or new password; invitations are room-scoped.

## Codec and device change requests

A new studio requests H.264, 10,000 kbit/s and 60 FPS; casters without a saved codec choice use H.264. Explicit saved settings remain unchanged and caster bitrate/FPS are not increased. VP8, VP9, H.264 and AV1 are available where supported; the interface shows the selected and negotiated codec. Requested settings do not guarantee measured quality.

In the studio, open the caster device controls and request a camera, microphone or audio output. The caster must accept the dialog before the change is applied and can decline it. A disabled camera or microphone stays disabled. Audio output selection requires a supporting browser.

## Caster card in the studio

The microphone level meter sits directly below the video. Settings use a grid, with key connection statistics beside them; help and hardware details expand separately. Pending statuses and errors remain visible. Narrow screens use a vertical layout with scrolling.

## Multiview, invitations, and framing

- The studio now has an experimental Multiview editor: grids and free layouts, movable and resizable slots, snapping guides, individual framing, rounded corners, and a shared placeholder when video is absent. Scenes can be duplicated, deleted, exported, and imported. Assign sources again after importing. A separate output link provides a transparent background for OBS/vMix Browser Source; publish scene changes with Apply.
- Customize room lets you set defaults for new invitations: join with the microphone off, audio only without enabling the camera on entry, and prevent casters from hearing each other. Saving settings does not change existing invitation links or connected sessions; issue new invitations.
- Caster framing in the studio changes immediately and saves automatically. Zoom, position, rotation, mirroring, and crop have sliders and precise number inputs in a compact panel near the video. These adjustments affect display in the studio and individual video output; the caster's source stream is not re-encoded. Multiview slots have their own settings.
- Studio Return supports a black background instead of a camera. Muting the output also mutes `/watch` and screen sharing; the audio meter reflects that mute. Personal monitoring remains separate.
- Room transfer, emergency backup, and room servers are grouped under Backup servers in the sidebar.

The multiview editor now has a visual grid for arranging cells: toggle it on or off and adjust the spacing from coarse to fine. The grid appears only in the editor and is absent from the published output.

Multiview remains experimental: up to 16 scenes and 32 slots, with no performance guarantee for every device. Start with a 2×2 grid. Scenes are stored on the current server and are not automatically transferred to a backup; export/import transfers the composition and requires sources to be assigned again. Share output links only with trusted broadcast recipients: a link grants access to room media. Browser audio may require a user click. Check your own cameras, network, and receiving software before a live broadcast.

## Device checks, roles, and private talkback

Before joining, casters have separate microphone, camera, and headphones/speakers checks. The checks share one row when space allows, with a wide join button below. Studio Return can go ON AIR without a mandatory test, and devices can change while publishing. Settings for the same session remain on the current server for up to 15 minutes after disconnection.

Administrator and moderator invitations are scoped to the room. A connected caster can accept a role offer. Acceptance stops their guest camera, microphone, and screen sharing before opening the staff panel in the same tab.

Only an administrator or moderator starts private talkback; these controls are absent from the primary studio. A caster holds the reply button to answer privately: only their microphone leaves the program while held. The studio microphone, program, screen sharing, and other participants’ audio remain unchanged. Releasing restores the previous microphone state unless it was separately muted in the meantime. If ending safely fails, the microphone stays muted; check the state and enable it manually.

Choose a PDF or PPTX of up to **1,500,000,000 bytes** each, wait for its preview and select Share presentation. PPTX is converted on the server; PDF opens in the browser. The new limit requires an updated server and converter with a **2 GiB** memory limit and at least **8 GB free** on its working disk. Document complexity and browser capacity may impose lower practical limits. [Details](PRESENTATIONS.md).

## Download

| Package | Purpose |
| --- | --- |
| [CastLink-Windows.zip](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) | The graphical `EasySetup.exe` wizard and the console version, `EasySetup-Console.cmd`; local or VPS installation |
| [CastLink-Linux.tar.gz](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.8-d703726cd50b/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) | Standalone server package for Linux Ubuntu without the Windows wizard. For SSH deployment, the Windows wizard uses the Linux dependency from its own Server Setup release. |

[All releases and their notes](https://github.com/resokol/castlink/releases). Get files and checksums from the same release. The wizard verifies downloaded packages automatically. To verify the Windows ZIP manually, run this in PowerShell:

```powershell
Get-FileHash .\CastLink-Windows.zip -Algorithm SHA256
```

Compare the result with this file's entry in `SHA256SUMS` for the chosen release.

The Linux package is not a standalone graphical installer for Linux. A macOS installer is planned; a ready-to-use package is not yet available. The server uses Docker, while the studio and casters use a browser.

The server interface is available in **Russian, English, and Simplified Chinese**. Russian is selected by default; the language switcher saves the choice in this browser. You do not need to leave the room to change languages.

## Requirements

- **Local:** Windows 10/11 x64, Docker Desktop compatible with your version of Windows and using Linux containers, hardware virtualization, and WSL2. The wizard offers to install Docker Desktop if it is missing; Windows may request administrator privileges and a restart.
- **VPS:** Ubuntu 22.04/24.04 amd64, a public IPv4 address, and SSH access with the `root` login and a password or private key. Docker Desktop on Windows is not needed to install on a VPS.
- Internet access to download packages and images. The camera and microphone require trusted HTTPS and browser permission; headphones are recommended for conversation.
- **Disk recommendation for an initial test:** at least 20 GB free, allowing room for images, updates, and backups. This is guidance rather than a measured minimum installation size.

A separate VPS profile with 2 GB RAM, configured swap, and service memory limits has been tested. This is not a guaranteed minimum for a standard installation or any broadcast load. You need to check resources for your number of casters, viewers, and video quality. The wizard uses prebuilt images; you do not need to build the application on the VPS.

Docker Desktop has its own terms of use. The terms and costs of your VPS, domain, and internet connection are set by their providers.

## Install on Windows

The steps below describe the standard Quick HTTPS scenario. For Advanced, first choose the network layout in [INSTALL.md](INSTALL.md); certificate and address settings depend on that layout.

1. Extract **all** of `CastLink-Windows.zip` into a separate folder. Run `EasySetup.exe`; `EasySetup.cmd` also opens the graphical wizard. Use `EasySetup-Console.cmd` for the console dialog.
2. In the **“On this computer”** card, click **“Install on this PC”** and select an installation folder. Quick mode is the default; explicitly enable advanced setup before starting if needed.
3. Select access: **LAN** for devices on your network, or **public IPv4** for internet connections. Check the suggested address.
4. Wait for Docker preparation to finish. If the wizard requests a restart, restart and open the wizard again: it will offer to resume the unfinished local installation. Keep the selected folder; you do not need to delete it or Docker data to continue.
5. Wait for installation and the HTTPS check to finish. For a local server, open the panel using the button in the wizard or the **CastLink** desktop shortcut; after the services start, click **“Open CastLink.”**
6. For a local installation, including a Windows server accessed through a public IP, the wizard offers to trust the self-signed certificate of that specific server. You also need to install its certificate on other devices on your network. The wizard creates a `CastLink-Certificate` kit; for another Windows PC, copy the entire kit and run `Install-Certificate.cmd`. Only trust your own server's certificate. Fully restart the browser after importing it.

LAN does not require a public IP. Accessing a Windows server from the internet requires a public address, allowed ports, and router port forwarding if necessary: the wizard does not provide a public IP or configure your router.

In the Windows wizard and management window, you can select **Русский / English / 简体中文**. Russian is selected by default; your choice is saved for the current Windows account. Detailed technical messages from Windows and Docker remain in their original language.

After a successful local installation, **CastLink** appears on the desktop. Opening the shortcut starts the control panel and services for that installation. The panel shows the status of Docker, services, and the website; **“Open CastLink”** opens it in a browser.

**Closing the window or choosing “Hide to tray”** leaves the server running. **“Stop services”** stops this installation while keeping the panel open. **“Stop and exit”** also closes the panel. Rooms and settings are preserved; Docker Desktop and other projects are not shut down. The panel is not added to Windows startup: open the shortcut to start the server. Sleep and shutting down the PC make the local server unavailable.

## Install on a Linux VPS from Windows

The steps below describe the standard Quick HTTPS scenario. For Advanced, first choose the network layout in [INSTALL.md](INSTALL.md); certificate and address settings depend on that layout.

1. Start the same wizard. In the **“On Linux Ubuntu”** card, click **“Set up Linux Ubuntu”**. Quick mode is the default; explicitly enable advanced setup before starting if needed.
2. Enter the IP, SSH port, and `root` login. Select password login or specify a private SSH key file (OpenSSH/PEM) and its passphrase if needed. On the first connection, compare the displayed **server key** fingerprint with your provider's information. The password and passphrase are only used for the current connection.

   After logging in successfully, you can create a new key: save the private file, then the wizard will add the public key to the VPS and verify the new login. An initial password or working key is still required. Existing server keys are preserved. Keep the private file yourself: it provides access to the VPS. The generated file is not encrypted with a passphrase; the wizard restricts access to the current Windows user.

3. A domain is optional. You can use a public IPv4 address or specify your own domain without `https://` or a path. For a domain, create an A record pointing to the VPS IP in advance; change DNS in your registrar's panel.
4. For a new installation with a domain, you can specify a separate TURN domain, such as `relay.example.org`, with an A record pointing to the same VPS. It provides a fallback media route over TCP/443. Leaving this blank retains standard TURN/UDP.
5. Wait for the Linux package download, dependency installation, service startup, and HTTPS check. Save the wizard's working folder and the displayed installation path on the server.
6. Open the displayed address in a browser. For a reachable public IP or domain, the wizard configures issuance and renewal of a public HTTPS certificate; clients do not need to install a self-signed local certificate.

The server must be externally reachable to obtain a public certificate. Selecting public mode does not fix an incorrect DNS record, blocked ports, or an address behind CGNAT. You can add a domain to a completed IP-based VPS installation later by running the wizard again for the same server.

### Network ports

For a standard installation, allow the following in the server firewall and provider panel:

| Purpose | Ports |
| --- | --- |
| HTTPS and public certificate issuance | TCP 443; also TCP 80 for a VPS with a public certificate |
| Direct media connection | TCP 7881, UDP 7882 |
| TURN/UDP | UDP 3478 and UDP 30000–30031 |
| Optional TURN/TLS | TCP 443 on the same server, with a separate TURN domain |

Keep access to your SSH port. Windows LAN requires the corresponding Windows Firewall permissions; internet connections through a router also require port forwarding. An existing server may have a different configured media port range: check its configuration and the wizard's messages.

## Your first room and casters

Creating a room requires the server room creation password set during installation. It differs from that room’s studio login password and optional guest password. To re-enter, use the room name and its studio password. If an older standalone Linux installation says creation is unavailable, follow [missing-password recovery](LINUX_MANUAL.md#room-creation-recovery) with the original state directory.

1. On your server's home page, select **“Create room.”** Enter a name and a separate **studio password** of at least eight characters. Set a caster password if needed.
2. In the studio that opens, select a camera, microphone, and listening device. Check the preview, then enable **ON AIR** to transmit Studio Return.
3. Create a caster invitation in the studio panel and send it to the caster privately. A caster password or invitation does not grant studio management rights.
4. The caster opens the link in a browser, allows the required devices, and checks audio/video. To rejoin, the studio uses **“Join existing,”** the room name, and the studio password.

Save the studio password. Invitations and watch links provide access to your room or stream: do not include them in a public bug report.

### Individual output for vMix/OBS

In the studio, copy the URL on the required caster's card and add it to vMix as a Web Browser or to OBS as a Browser Source. Each caster URL shows a separate clean camera and audio output. Screen sharing uses a separate **“Caster screen”** link. Use the entire URL, including its secret part; you do not need to guess an address from the caster's name.

### Watch the studio through `/watch`

The studio or room administrator provides a separate Studio Return watch link. Multiple viewers can open one link at the same time; each gets their own connection. Viewers receive studio video and broadcast audio without a camera, microphone, controls, or caster streams. The browser may ask them to click **“Enable sound”;** each viewer toggles audio and video only for themselves.

For viewers, the studio sends one additional stream to the server, and the server delivers it to each viewer. Server outbound traffic grows with the number of viewers and bitrate. Unlimited connections are not promised here: capacity depends on your network, server, and video quality.

## Connecting through TURN

Usually, leave **“Automatic”** selected: the browser chooses an available route, including configured TURN. If the initial media connection fails with an applicable network error or timeout, CastLink retries it once with TURN required. This is not a permanent switchover on every lost packet.

If a connected caster is affected by their network or VPN, the studio can select **“Caster audio and connection” → “Caster route” → “Fallback TURN.”** Wait for confirmation that the change has been applied: only the selected caster reconnects. The caster does not enter a separate TURN username or password.

TURN/UDP is included in a standard installation. TURN/TLS on TCP/443 is useful for networks that block UDP; it needs a separate domain and a correctly issued certificate. TURN does not guarantee operation through every VPN or corporate filter, and it does not restore a server that is off.

## Additional server and backup

In **“Room servers,”** you can install CastLink on another VPS or connect a compatible existing installation. Before broadcasting, check trusted HTTPS and the reachability of both addresses on casters' devices.

- **Planned transfer** is started manually by the primary studio. If the target fails, a healthy source keeps working.
- **Emergency backup** is selected in advance; one backup is prepared at a time for the current group of casters. The snapshot refreshes every 30 seconds and is valid for no more than five minutes.
- **Automatic emergency transfer** is off by default. Enabling it requires an open, prepared primary studio tab and confirmation from the backup. The tab and backup independently confirm a sustained source failure; a single caster failure does not transfer the room. A studio tab that is closed or suspended by the browser does not trigger automation.
- Prepared, open caster and `/watch` tabs follow a confirmed transfer. A source that is off cannot reload the page: do not refresh its tab during an outage. If preparation has expired, an available source is needed to refresh it.
- The transition may interrupt audio/video; the browser may require device permissions, screen selection, or audio activation again. This is not a seamless cluster. Returning to a recovered server is always manual.

Disabling automation is complete only after the backup confirms it. Old links do not become permanent redirects: give new casters and viewers links from the target server after a transfer.

### SSH key in the studio panel

When connecting a backup, select password login or a private SSH key. In the key creation section, first create and download the private file, then click “Install generated key on VPS.” This requires a valid password or an already configured key, and you must verify the server fingerprint separately. After successfully verifying the new login, select the downloaded file to install or connect CastLink. Existing keys and password login are not removed. The generated private file has no passphrase protection: store it like a server password.

## Updating and uninstalling

1. Before updating, allow **UDP 7882** in your provider's network firewall and the server firewall. If the server is behind a router, forward this port too. Keep **TCP 80/443/7881**, **UDP 3478**, and allow **UDP 30000–30031**. Keep your SSH port accessible. Optional TURN/TLS uses **TCP 443** and a separate TURN domain.
2. Back up data and configuration. For a Windows-wizard installation, extract the complete new Windows package, run `EasySetup.exe`, choose **Update**, and select the existing local folder or the same VPS. For a standalone Linux-helper installation, run `check-updates` and `update` from the new extracted package using the existing `--state-dir`: [steps](LINUX_MANUAL.md). The `easy-setup-8b02e2d4dc3c` legacy guide remains a separate procedure; the new helper does not adopt that installation.
3. Update between broadcasts: the installer recreates the LiveKit container to apply the media ports, interrupting active media connections. Updating the existing installation preserves its data; deleting the installation or data volumes is unnecessary.
4. After updating, check the website, a new caster connection, audio and video, individual output, `/watch`, and your configured backup from the networks you use. Open the updated browser interface.

The new Easy Setup layout uses **UDP 7882 / TCP 7881** for direct media, **UDP 3478** for TURN, and **UDP 30000–30031** for TURN relay. It replaces the former **UDP 61000–61100** media range and **UDP 30000–30999** relay range. External firewall rules and router forwarding are configured separately from Docker; downloading the new ZIP alone does not update the server.

Updating a connected VPS from the studio panel updates web and its presentation converter while preserving other infrastructure and existing media ports. It requires administrative access to the selected managed installation; a normal connection link grants no such permission. Use the appropriate installer and actual server configuration to change the network layout.

To uninstall, select **“Uninstall,”** check the displayed server and path, then confirm the chosen action by typing **`DELETE`**. On a VPS, the wizard finds installations after connecting over SSH.

By default, the selected installation's server containers are removed, while rooms, settings, and data volumes are preserved. **Full removal including rooms and settings is a separate choice that loses data.** Data that has already been deleted can only be restored from your backup. Keep the working folder and configuration so you can restart with the retained data; deleting the downloaded ZIP does not uninstall the server.

## How to help with testing

Start with a small test room: two browsers, a microphone/camera, a caster output in vMix/OBS, and `/watch`. Then test other devices and networks, reconnection, updating, and your chosen backup. Do not test removal or server failure on the only copy of a live broadcast.

When reporting a bug, include:

- The version/build identifier from the interface or `/api/version`, OS, and browser.
- Where the server runs: locally or on a VPS; connection type without specific addresses.
- Your actions, expected and actual results, and whether the error repeats.
- An anonymized error message or screenshot; for media, devices and the result of testing another network.

You can report ordinary bugs in the [public repository Issues](https://github.com/resokol/castlink/issues) or send them to the author on [Telegram](https://t.me/sklvmax). **Do not publish passwords, tokens, cookies, invitations, personal output/watch links, full configurations and logs, internal IP addresses, or SSH details.** Before sending a screenshot, hide secret fields and the address bar if it contains personal links. Report vulnerabilities privately to the author on Telegram first, without publicly disclosing secrets or attack methods.

The wizard targets Windows 10/11; this does not claim that every OS version, VPS, browser, or physical device has been tested. Real broadcasts and sustained load require your own testing. Author contact: [Telegram](https://t.me/sklvmax) · [GitHub](https://github.com/resokol).

## License and repository contents

CastLink-owned source code in this repository is available under [MIT](../../../LICENSE), allowing use, modification and distribution while retaining the copyright and permission notice. Third-party components retain their own licenses.

Already released Client `f6c47a27a62c` and Server Setup/Linux `d703726cd50b` packages retain their included CastLink Freeware Distribution License 1.1. Their archives and SHA256 values are unchanged. The current source MIT license does not replace the license inside those packages; the included `LICENSE` determines each package's terms.

GitHub's automatic **Source code (zip/tar.gz)** archives contain the selected tag's files in `resokol/castlink`. They are not installers: download `CastLink-Windows.zip` / `CastLink-Linux.tar.gz` from the selected release's Assets.

The additional `CastLink-ThirdParty-Sources.tar.gz` in Assets contains the corresponding source code of third-party open-source components and their build recipes. It is not needed to install CastLink. The application's own source code is not included in that archive.

---

[Set up TURN/TLS on TCP 443](TURN_TLS.md)

## Automatic cleanup

The installers now retain two successful image versions and run cleanup hourly. See [automatic cleanup](INSTALL.md#automatic-cleanup) for details and update instructions.
