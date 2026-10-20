[Русский](../../PRESENTATIONS.md) · **English** · [简体中文](../zh-CN/PRESENTATIONS.md)

## 20.10.2026 · 1.0.0-rc.8 · bdfe91a92b6b

- Updated the Windows server wizard and the multipage Windows Client installer with a folder selection step. The remote server option is named “On Linux Ubuntu”; quick setup is the default and advanced settings are selected explicitly.
- Website downloads are ordered Windows Client, Windows Server, Linux Ubuntu. The Ubuntu block highlights a manual covering out-of-box and advanced installation, with a link to recent release notes.
- Fixed caster name synchronization during reconnection and session renewal. Caster video fits the available area while retaining its aspect ratio.
- Windows Client, Windows Server Setup and Linux now have separate release tracks, versions and assets.

Back up your own server and end active connections before updating. Update Windows Client manually: fully close the old client and install the new EXE. EXEs do not update themselves and are unsigned. Refresh pages manually outside a broadcast. Physical PowerPoint, devices and a complete broadcast have not been tested separately.

**[CastLink packages](PRODUCTS.md)** · [Installation manual](LINUX_MANUAL.md)

## 20.10.2026 · 1472cd052d7e · Caster workspace and control-window fixes

- Native Windows panels follow the selected CastLink theme; the screen-source picker supports light and dark themes.
- The caster gallery uses available width, chat is 15% narrower and controls are centered. Studio-only viewing retains a local camera preview. Fullscreen tiles hide controls while idle.
- Staff can delete a standalone invitation before it is attached to a slot; linked permanent outputs remain available.
- An absent microphone profile defaults to original audio without noise suppression or echo cancellation. Explicitly saved speech profiles are retained.
- Multiview crop masks source edges without moving, rescaling or changing source proportions.
- The browser floating panel has a Compact size button. Click it if the browser restores an enlarged window; the shared size accounts for the independent STOP area. The browser can still choose its own initial geometry.

Update the server and Windows client. Fully close the old client before launching the new EXE; the EXE does not update itself. Refresh pages manually outside a broadcast. Back up your own server and end active connections before updating. EXEs are unsigned. Physical PowerPoint, devices and a complete broadcast have not been tested separately.

The isolated PPTX converter, existing limits and server permissions are preserved. And other minor changes.

# PDF, PPTX and presentation controls

Current combined release: [easy-setup-1472cd052d7e](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-1472cd052d7e), runtime `1.0.0-rc.3-1472cd052d7e`. Update the server and Windows client together.

## Prepare and share

1. Open the presentation panel and select **Choose PDF / PPTX**. PDF files may be up to **100 MB**; PPTX files up to **25 MB**.
2. PDF opens in the browser. PPTX is sent to your server and converted to PDF by an isolated converter; this does not require an installed PowerPoint. Wait for the preview.
3. Check page count, fonts and layout, then select **Share presentation**. The document is shared as a separate video stream without audio.
4. Use **Previous** and **Next**. Under **Remote control**, explicitly grant control to a selected participant, then revoke or reclaim it when needed. This controls pages without access to your computer's mouse or keyboard.
5. Select **Stop presentation** / **STOP PRESENTATION** to finish. Closing a menu or panel does not stop active sharing. If stopping fails, the error remains visible and you can retry.

## Control panel

Drag the panel by its header. In supported Chrome/Edge, **Show above other windows** opens a Document Picture-in-Picture window after your action; if unavailable or denied, controls remain on the page. The Windows client uses the native panel when available. STOP remains accessible while the slide menu is open.

## Compatibility and limits

- PDF/PPTX is shown as static pages. PPTX animation, video, music and interactive elements do not play in this mode.
- Standard PPTX files can contain normal SVG, charts, embedded chart data and links. An exact match with PowerPoint is not guaranteed for every document.
- Missing original fonts can change wrapping and layout. Export PDF on the original computer for a fixed appearance; embed fonts only when their licenses allow it.
- Encrypted or password-protected documents are not accepted. Save an unlocked copy or export PDF.
- Corrupt-file, password, busy and unavailable-converter errors are distinguished. Retry later when busy; contact your server owner when unavailable. PDF does not require the converter.

For live PowerPoint with animation or video, start its slideshow and separately use **Screen share**, selecting its window and audio when needed in the source picker. Connecting controls to an open PowerPoint is a separate Windows workflow requiring installed PowerPoint; its behavior depends on your environment and needs a check before a broadcast.

[CastLink guide](GUIDE.md) · [Changelog](CHANGELOG.md)
