[Русский](../../CHANGELOG.md) · **English** · [简体中文](../zh-CN/CHANGELOG.md)

# CastLink changelog

These notes apply to the ready-to-use packages of the listed releases. New features appear here after a build is published.

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
