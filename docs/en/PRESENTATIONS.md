[Русский](../../PRESENTATIONS.md) · **English** · [简体中文](../zh-CN/PRESENTATIONS.md)

# PDF, PPTX and presentation controls

Current combined release: [easy-setup-063e4967c05b](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-063e4967c05b), runtime `1.0.0-rc.3-063e4967c05b`. Update the server and Windows client together.

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
