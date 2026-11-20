[Русский](../../RELEASE_NOTES_1_0_7.md) · [English](RELEASE_NOTES_1_0_7.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_7.md)

# CastLink 1.0.7 — stable server and web release

Stable server and web release based on the accepted castlink.ru version. Exact packages, versions and checksums are listed in the [catalog](PRODUCTS.md). Existing archives and tags remain unchanged.

## Included changes

- **Video diagnostics:** Studio statistics → Video diagnostics → JSON exports sender/receiver history, available FPS, bitrates, loss, frame and freeze counters. The selected period, participants and sessions are retained; incomplete exports are marked `partial`.
- **Audio diagnostics:** history distinguishes publication, SDK-track, MediaStreamTrack and player mute. Available actual capture/processing settings, silent concealment and decoder rate correction are recorded. Old samples and unsupported browser fields remain unknown; diagnostics do not automatically repair distortion.
- **Rolling 10-second network quality:** current grades and loss distinguish audio/video and caster → server / server → studio directions. Session history is retained; audio-only casters are supported.
- **Studio stream in vMix:** fixes `AbortSignal.any is not a function` in affected embedded browsers, including the vMix 28 configuration. Refresh the vMix browser input after updating the server. This fix does not establish independent verification of a live vMix broadcast.
- **Windows Server on WSL2:** installation without Docker Desktop and a native Windows panel for start/stop, opening the server, statistics and 24-hour export. Maintenance lets you select an installation, check an update, remove with an archive, restore an archive and recover an interrupted operation. The server runs inside WSL2; it is not a Windows service.

Diagnostic details: [guide](STUDIO_DIAGNOSTICS.md). Requirements, networking and maintenance: [Windows/Ubuntu](../../../README.en.md) · [server](SERVER_INSTALL.md).

## Updating

Maintenance **1.0.7** supports updating an existing **1.0.6-rc.1** installation with the exact tag `server-wsl-v1.0.6-rc.1-dad063393b53`. Use the new 1.0.7 maintenance tool, select the existing installation and verify its address, folder and target version before updating off air.

1. Choose the exact package for **your release channel** in the catalog and verify its `SHA256SUMS`. Windows/WSL2 and Linux are released separately; do not use the shared `releases/latest`.
2. Update the existing server **off air**, retaining its installation and data. For WSL2, use the matching release's maintenance tool and check the selected address/folder; for Linux, use the normal `update` with the original data directory (`--state-dir`). Rerunning the initial installation command does not update a completed Linux installation.
3. Once the updated server is running, reload studio and caster pages, including pages in Windows Client. New diagnostic fields require refreshed pages; old history is not backfilled.
4. Check another device's connection, audio, camera, individual OBS/vMix links and diagnostic export.

**Windows Client remains 1.0.1:** the existing client loads its selected updated server's web UI after a page reload. Reinstalling Client is unnecessary for these server changes.

**Windows/Docker Server Setup remains Legacy 1.0.4.** No new package is produced for that channel. Automatic Docker → WSL2 migration is unsupported; retain existing data. A WSL2 removal archive contains passwords and keys: keep its entire folder private and separate from the statistics ZIP.
