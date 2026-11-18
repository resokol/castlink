[Русский](../../RELEASE_NOTES_1_0_6.md) · [English](RELEASE_NOTES_1_0_6.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_6.md)

# CastLink 1.0.6 — video diagnostics

Studio statistics now includes **Video diagnostics → JSON** beside audio history. It downloads stored video samples for the selected period and participant/session filters. Select **all participants** to compare the studio sender with caster receivers.

The file contains UTC timestamps, codec, dimensions, FPS, bitrate, loss, latency and available frame, encode/decode and freeze counters. It does not record video or audio. This is a CastLink log; Chrome’s internal dump remains a separate download from `chrome://webrtc-internals`.

New counters arrive after studio and caster pages update. Older samples retain only their existing fields; missing values do not mean zero. Exports that hit the size limit are marked partial; choose a shorter period or one session. Diagnostics does not automatically repair network problems or video freezes.

## Updating

Update the existing installation **off air**, keeping its data, UUID, passwords, address and certificates. Once the server is ready, manually reload studio and caster pages, including pages inside Windows Client, then check audio, video and JSON download.

Linux uses its independent **1.0.6** release track. Windows/WSL2 uses a separate **1.0.6-rc.1** prerelease. Use its maintenance tool with the selected existing installation; Docker migration is unsupported. Exact available packages and validation results are listed on each GitHub release page.

Windows Client remains **1.0.1** and displays its selected server’s UI. Publishing a package does not update installed servers or open tabs. Previously published packages and checksums remain unchanged.
