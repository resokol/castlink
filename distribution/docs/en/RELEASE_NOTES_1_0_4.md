[Русский](../../RELEASE_NOTES_1_0_4.md) · [English](RELEASE_NOTES_1_0_4.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_4.md)

# CastLink Server and Linux 1.0.4 · Windows Client 1.0.1

## Web fixes — November 16, 2026

- The current network grade uses the last 10 seconds; session loss history is retained separately. Percentages appear before packet counts.
- Both legs are measured: caster → server, separately for audio and video, and server → studio. Audio-only casters also receive a grade. Counters from different legs are not added together.
- Missing, stale and reordered reports cannot become fresh zero-loss readings. The overall grade uses the worst fresh measurement; Good requires fresh data for every active leg.
- Existing WebRTC reports and the existing send cycle are reused. No extra RTC polling or timers are added; metric updates preserve video and open menus.

After updating the web server, manually reload **both studio and caster pages** off air. These fixes are included in current source; existing installer archives and checksums remain tied to their published builds. Windows Client displays its selected server's interface.

## Original 1.0.4 / 1.0.1 packages

Guest cards now show measured incoming camera and microphone bitrates and the
network grade. A small arrow beside the grade opens a compact guide with the
Good, Medium and Poor thresholds and the current measurements. It also works
when no data is available. Close it with its close button, Escape or an outside
click. Opening the guide preserves card dimensions and video owners.

The existing grade uses the worst of cumulative packet loss, jitter and RTT; it
does not measure internet bandwidth. Missing or stale samples show dashes.
Metric updates do not reload the page, and identical samples preserve the guest
list state.

The same server release includes the shared noise and echo suppression switch in caster microphone settings and studio controls. New microphones start with processing off; an explicit saved choice is retained. Studio changes receive the applied result without manual caster approval. Switching preserves mute, camera and private talkback.

## Updating

- Update the existing Server Setup or Linux installation to 1.0.4 off air,
  retaining its data and configuration. Then manually reload studio/guest pages.
- Install Windows Client 1.0.1 through its update check or manually. The client
  displays its selected server's interface, so that server also needs the update.
  The client does not embed a separate copy of the web studio.
- Source, Client, Server Setup and Linux use one verified main commit with
  independent product versions. Experimental WSL packages remain experimental.

This release retains the fixes already on current main. Existing published
archives and checksums remain unchanged. Verified download links and exact
source/build IDs appear in the [product catalog](PRODUCTS.md) after publication.
