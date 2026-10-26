[Русский](../../RELEASE_NOTES_RC9.md) · [English](RELEASE_NOTES_RC9.md) · [简体中文](../zh-CN/RELEASE_NOTES_RC9.md)

# CastLink 1.0.0-rc.9

## Server: Linux and Windows Server Setup

- Caster preflight advanced settings offer camera resolution Auto/720p/1080p and FPS Auto/15/30/50/60. Both default to Auto.
- In Window mode, a pin selects the large participant tile for the current caster only. No participant is pinned by default.
- H.265 can be selected in supported browsers. Sending and viewing require the respective codec support; H.264 remains the default.
- The caster toolbar has desktop captions, icons only on mobile, and a Leave button.
- Window/Tile and view settings move to the header before Online. The service footer is available by scrolling below the workspace.
- Corrected the STUDIO PLAYBACK label.

## Updates for all three products

Fixed asset URL validation after the repository was renamed to `resokol/castlink`. Exact URLs for this repository and its previous name `resokol/castlink-releases` are accepted; tag, file inventory and checksum validation remain in place.

**Older Windows Clients need one manual upgrade:** download the rc.9 installer from the [product catalog](PRODUCTS.md), verify SHA256SUMS, and install after ending your session. An older client may incorrectly report no updates. Normal update discovery works again after this upgrade.

For your own server, use the new Windows Server Setup or Linux package and the normal update procedure for your installation. Download the package manually if the older update checker finds no release. Updating the client EXE does not update the server. Participants receive the new web interface after the server is updated and the page is reloaded.

End active sessions and preserve necessary data before updating. Installation requires user action. Existing archives, tags and checksums are not replaced.
