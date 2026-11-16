[Русский](../../RELEASE_NOTES_1_0_5.md) · [English](RELEASE_NOTES_1_0_5.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_5.md)

# CastLink Server Setup and Linux 1.0.5 · source 1.0.5

These notes apply to server packages and the source archive **1.0.5**. Windows Client remains **1.0.1** and displays its selected server interface. Check the [product catalog](PRODUCTS.md) for available releases, exact source/build IDs, download links and checksums. Previously published 1.0.4 archives and their SHA256 values remain unchanged.

## Changes

The server packages include the latest network web fixes, [documented for current source on November 16](RELEASE_NOTES_1_0_4.md):

- The current grade covers the last **10 seconds**; session loss history is kept separately. Percentages appear before lost packet counts.
- **Caster → server** and **server → studio** are displayed separately. Upload measurements cover both audio and video; audio-only casters also receive a grade. Counters and percentages from different legs are not added together.
- The overall grade reflects the worst fresh measurement. Good requires fresh data for every active leg. Missing feedback, the first baseline, stale, duplicate and reordered messages cannot become fresh zero-loss readings. Old-message protection survives signal reconnection.
- Receive freshness is limited to **6 seconds**, and upload feedback to **12 seconds**. Repeated cached RTCP reports do not extend it. History remains separate from the current measurement across track changes; a new participant session starts its own history.
- Existing WebRTC reports and the existing send cycle are reused. No extra RTC polling or timers are added; metric updates retain video, menus and focus.

Updating the website or documentation does not add web fixes to an installer archive already downloaded. Windows Client does not embed a separate web studio; these fixes require an updated server.

## Updating

1. Update **off air**. Save any required data and configuration backup.
2. For Windows Server Setup, extract the new package separately, run `EasySetup.exe`, choose **Update**, and select the existing local installation or the same VPS. For standalone Linux, use `check-updates` and `update` from the new package with the **same `--state-dir`**: [instructions](INSTALL.md). Retain UUIDs, secrets, settings and volumes; deleting data and reinstalling is unnecessary. Publishing a package does not update a running server.
3. After readiness checks, manually reload **both studio and caster pages**, including pages in Windows Client. Both sides need the new web code for the studio to receive caster upload measurements.
4. Check audio, video, an audio-only caster, individual output and any `/watch` output you use.

## Platforms

The ordinary local Windows Server Setup uses **Docker Desktop**; standalone Linux and VPS installations use **Docker/Compose**. Docker-free Windows/WSL2 remains a separate experimental channel: this release does not promote it to a stable product or migrate Docker installation data into it.
