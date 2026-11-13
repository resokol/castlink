[Русский](../../RELEASE_NOTES_1_0_3.md) · [English](RELEASE_NOTES_1_0_3.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_3.md)

# CastLink Server and Linux 1.0.3 · Windows Client 1.0.1

Guest cards now show measured incoming camera and microphone bitrates and the
network grade. A small arrow beside the grade opens a compact guide with the
Good, Medium and Poor thresholds and the current measurements. It also works
when no data is available. Close it with its close button, Escape or an outside
click. Opening the guide preserves card dimensions and video owners.

The existing grade uses the worst of cumulative packet loss, jitter and RTT; it
does not measure internet bandwidth. Missing or stale samples show dashes.
Metric updates do not reload the page, and identical samples preserve the guest
list state.

## Updating

- Update the existing Server Setup or Linux installation to 1.0.3 off air,
  retaining its data and configuration. Then manually reload studio/guest pages.
- Install Windows Client 1.0.1 through its update check or manually. The client
  displays its selected server's interface, so that server also needs the update.
  The client does not embed a separate copy of the web studio.
- Source, Client, Server Setup and Linux use one verified main commit with
  independent product versions. Experimental WSL packages remain experimental.

This release retains the fixes already on current main. Existing published
archives and checksums remain unchanged. Verified download links and exact
source/build IDs appear in the [product catalog](PRODUCTS.md) after publication.
