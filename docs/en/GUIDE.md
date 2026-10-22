[Русский](../../GUIDE.md) · **English** · [简体中文](../zh-CN/GUIDE.md)

# CastLink — installation and user guide

Windows Client is **1.0.0-rc.8**, build `90135013f5b6`; Windows Server and Linux Ubuntu are **1.0.0-rc.8**, build `72b315b2d251`: [packages and checksums](PRODUCTS.md). Get the package and `SHA256SUMS` from the same track and release.

Portrait mobile Tiles uses two 16:9 columns. Chat offers 24 emoticons while history and export keep ordinary Unicode. Reactions offers seven two-second animations with reduced-motion support; reactions are not added to chat or clean outputs.

Reopening the same invitation restores its slot when a valid signed session remains saved. A second tab is isolated; its denied entry does not erase the first tab’s session. Expired or revoked permission is not restored.

The studio layout is more compact: playback and invitations are on the left, outbound stream and transport on the right. Wide windows fit five guest cards and four equal settings in a 2×2 grid below the graph. Narrow windows retain sequential sections.

Windows EXEs are unsigned. Updates require user consent and may restart the app or services; schedule a broadcast pause and save the data you need yourself. End-user servers create no automatic backups. Test physical devices, PowerPoint and your documents before going live.

[Download](README.md) · [Changelog](CHANGELOG.md) · [Manual Linux installation](LINUX_MANUAL.md)

CastLink is a browser-based studio for connecting casters, receiving their audio and video in vMix/OBS, and separately watching the studio broadcast. Install the server on your Windows computer or Linux VPS. Casters open your address in a browser; Docker is not required on casters' computers.

Official packages and guides are published here. The application is undergoing public testing: before a real broadcast, test your own devices, network, and connection recovery.


The caster workspace offers Windows (layout) and Tiles views. On desktop, the vertical separator in Windows view resizes the main camera or screen and the right rail. With multiple sources, use the pointer or keyboard. The guest rail scrolls separately and video keeps its proportions. Mobile has no separator; compact controls and More remain. Screen sharing uses a mint button and co-presentation a blue button.
## Setup mode and server address

In rc.8, Quick is the default. Explicitly enable **Advanced setup** in the Windows wizard for technical options; add `--advanced` in the standalone Linux CLI. Quick uses standard HTTPS and ports. Advanced supports HTTP, direct HTTPS or an external HTTPS proxy, plus website and media addresses and ports. The wizard and Linux CLI support RU / EN / 简体中文. See [installation modes and configuration examples](INSTALL.md).

When updating, select the existing installation: saved modes, addresses, ports, UUID and secrets are retained. A completed installation's network layout is not changed automatically. Backup servers can be added after quick setup.

In proxy mode the browser uses external HTTPS, while the proxy forwards every path, including `/rtc` and WebSocket, to CastLink's internal Caddy. Trust only the proxy IP/CIDR **seen by Caddy inside Docker**, which may be a gateway address. Do not trust every source. For a proxy on another host, choose a reachable private bind instead of localhost and restrict the firewall. An internal HTTP response does not verify the external HTTPS chain.

Plain HTTP on a LAN/public IP is not a secure context for camera, microphone or screen sharing. Local `localhost` is a browser exception that does not extend to other devices. Use trusted HTTPS: a public certificate or your own CA imported on client devices. Custom ACME ports still need an externally reachable certificate-validation route; see INSTALL.

Default media ports are TCP 7881, UDP 7882, TURN UDP 3478 and UDP 30000–30031. For Advanced, open the ports actually configured. The website proxy does not replace LiveKit/TURN or NAT/firewall setup; web:3000 and PostgreSQL are not published.

The Linux helper `scripts/linux-compose-setup.py` provides `init`, `start`, `status`, `check-updates` and `update` with the existing `--state-dir`. UUIDs, secrets, networking and volume names persist; Windows/legacy installations are not adopted. The `backup` command is removed; save required data and configuration copies yourself. [Linux](LINUX_MANUAL.md).

## Chat history, staff cards, and stopping screen sharing

Room messages are stored on the current server for 24 hours and restored when you rejoin or reopen the interface. Existing history is not counted as new unread messages: the badge counts new incoming messages while chat is closed. Opening the chat tab clears the count. In Statistics, click “Download chat · 24 hours” to save the last day of messages as a UTF-8 text file.

Administrator and moderator panels place the name, microphone, and speakers at the top. Caster cards are 313 px wide, fitting five per row when space allows; narrow layouts adapt to the available width. Use Whisper on the relevant caster card for private talkback.

When screen sharing starts, Chrome or Edge with Document Picture-in-Picture support attempts to open a red stop-sharing panel. If it does not appear, click “Show stop-sharing panel”. Move the window by its browser title bar. Closing it hides the panel without stopping screen sharing; you can open it again. STOP SHARING ends the capture, and ending capture elsewhere also closes the panel.

The panel uses browser features. Availability, minimum window size, and automatic opening depend on the browser; excluding the panel from captured video is not guaranteed. Test your chosen capture mode before broadcasting. If floating windows are unavailable, stop sharing with the normal CastLink button.

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
| [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/SHA256SUMS) | The graphical `EasySetup.exe` wizard and the console version, `EasySetup-Console.cmd`; local or VPS installation |
| [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/SHA256SUMS) | Standalone server package for Linux Ubuntu without the Windows wizard. For SSH deployment, the Windows wizard uses the Linux dependency from its own Server Setup release. |

[All releases and their notes](https://github.com/resokol/castlink-releases/releases). Get files and checksums from the same release. The wizard verifies downloaded packages automatically. To verify the Windows ZIP manually, run this in PowerShell:

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

The **Update button for a backup server inside the studio updates only the web application**. It does not recreate LiveKit or migrate an existing installation to the new media ports. Use the new installer to make this transition. Check custom installations against their actual configuration.

To uninstall, select **“Uninstall,”** check the displayed server and path, then confirm the chosen action by typing **`DELETE`**. On a VPS, the wizard finds installations after connecting over SSH.

By default, the selected installation's server containers are removed, while rooms, settings, and data volumes are preserved. **Full removal including rooms and settings is a separate choice that loses data.** Data that has already been deleted can only be restored from your backup. Keep the working folder and configuration so you can restart with the retained data; deleting the downloaded ZIP does not uninstall the server.

## How to help with testing

Start with a small test room: two browsers, a microphone/camera, a caster output in vMix/OBS, and `/watch`. Then test other devices and networks, reconnection, updating, and your chosen backup. Do not test removal or server failure on the only copy of a live broadcast.

When reporting a bug, include:

- The version/build identifier from the interface or `/api/version`, OS, and browser.
- Where the server runs: locally or on a VPS; connection type without specific addresses.
- Your actions, expected and actual results, and whether the error repeats.
- An anonymized error message or screenshot; for media, devices and the result of testing another network.

You can report ordinary bugs in the [public repository Issues](https://github.com/resokol/castlink-releases/issues) or send them to the author on [Telegram](https://t.me/sklvmax). **Do not publish passwords, tokens, cookies, invitations, personal output/watch links, full configurations and logs, internal IP addresses, or SSH details.** Before sending a screenshot, hide secret fields and the address bar if it contains personal links. Report vulnerabilities privately to the author on Telegram first, without publicly disclosing secrets or attack methods.

The wizard targets Windows 10/11; this does not claim that every OS version, VPS, browser, or physical device has been tested. Real broadcasts and sustained load require your own testing. Author contact: [Telegram](https://t.me/sklvmax) · [GitHub](https://github.com/resokol).

## License and repository contents

New official packages are distributed under the [CastLink license](../../LICENSE): use is free; you may share **unmodified official packages** with attribution and the license preserved. Modifications require written permission from the author. The application's source code is not published in this repository.

GitHub's automatic **Source code (zip/tar.gz)** archives contain the files of this public repository: documentation and accompanying materials. They do not contain the private application's source code and do not replace the `CastLink-Windows.zip` / `CastLink-Linux.tar.gz` installation packages in the release Assets.

The additional `CastLink-ThirdParty-Sources.tar.gz` in Assets contains the corresponding source code of third-party open-source components and their build recipes. It is not needed to install CastLink. The application's own source code is not included in that archive.

---

[Set up TURN/TLS on TCP 443](TURN_TLS.md)

## Windows client and separate server packages

If the native Windows panel still shows the older control label, update Client: F10 → Check for updates, or download the new installer manually. Replace older versions without update checks manually. Updating the server does not replace the EXE; finish your broadcast first. EXEs are unsigned.

This release combines the current server, the new Linux installer and the separate Windows client.

[Install the client](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-setup.exe) · [Portable client](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-1.0.0-rc.8-90135013f5b6-Windows.exe) · [Client ZIP](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-win-x64.zip)

The client connects to an existing server and checks the client channel and saved managed servers separately. You can check manually or disable automatic checks. Downloads are SHA256-verified; closing the client and installing a new version require separate consent. Replace older clients without built-in update checks manually; a server update does not replace the client EXE.

Updated caster/chat layouts, complete-frame fitting, embedded PPTX fonts, streaming uploads and remote slide navigation. Quick/advanced setup, proxy modes and the standalone Linux helper are retained. Room-creation password settings are available separately.

Use CastLink-Windows.zip or CastLink-Linux.tar.gz for the server. A saved managed VPS is updated through the Windows wizard with SSH access when needed; a normal connection URL grants no update permission. New presentation features require updating both web and converter through the matching full server package. The Linux helper manages only its own installations. Finish the broadcast before updating.

CastLink-ThirdParty-Sources.tar.gz and CastLink-ThirdParty-Office-Sources.tar.gz are optional source archives and are not required to install. The Windows client is unsigned; Each release has SHA256SUMS for its own files.
