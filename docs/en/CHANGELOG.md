[Русский](../../CHANGELOG.md) · **English** · [简体中文](../zh-CN/CHANGELOG.md)

# CastLink changelog

These notes apply to the ready-to-use packages of the listed releases. New features appear here after a build is published.

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
