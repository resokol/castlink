[Русский](../../PRESENTATIONS.md) · **English** · [简体中文](../zh-CN/PRESENTATIONS.md)

# PDF, PPTX and presentation controls

Current packages are **1.0.0-rc.8** (`90135013f5b6`): [Windows Client, Server Setup and Linux](PRODUCTS.md). Update the server for server features and Client for bundled Windows UI and native panels. Track versions are independent; earlier releases are listed in the [changelog](CHANGELOG.md).

## Prepare and share

1. Open the presentation panel and select **Choose PDF / PPTX**. Each PDF/PPTX may be up to **1,500,000,000 bytes**.
2. PDF opens in the browser. PPTX is sent to your server and converted to PDF by an isolated converter; this does not require an installed PowerPoint. Wait for the preview.
3. Check page count, fonts and layout, then select **Share presentation**. The document is shared as a separate video stream without audio.
4. Use **Previous** and **Next**. **Controls** opens the delegation menu. The owner can still navigate after delegation; only the owner delegates, reclaims and stops sharing. A competing stale command is rejected as a conflict (409): check the current page and explicitly retry. This controls pages without access to your computer's mouse or keyboard.
5. Select **Stop presentation** / **STOP PRESENTATION** to finish. Closing a menu or panel does not stop active sharing. If stopping fails, the error remains visible and you can retry.

## Control panel

Selecting Share presentation immediately opens compact controls from your click. The Windows client prioritizes an available native panel; supported desktop browsers use Document Picture-in-Picture. If unavailable or denied, controls stay on the page. Closing the panel does not stop sharing.

If the native Windows panel still shows the older control label, update Client: F10 → Check for updates, or download the new installer manually. Replace older versions without update checks manually. Updating the server does not replace the EXE; finish your broadcast first. EXEs are unsigned.

Drag the panel by its header. In supported Chrome/Edge, **Show above other windows** opens a Document Picture-in-Picture window after your action; if unavailable or denied, controls remain on the page. The Windows client uses the native panel when available. STOP remains accessible while the slide menu is open.

## Compatibility and limits

For the 1,500,000,000-byte limit, update both server and converter using the current full server package: the converter has a 2 GiB memory limit and needs at least 8 GB free on its separate working disk. File size alone does not guarantee conversion; check pages, fonts and delay on your equipment.

- PDF/PPTX is shown as static pages. PPTX animation, video, music and interactive elements do not play in this mode.
- Standard PPTX files can contain normal SVG, charts, embedded chart data and links. An exact match with PowerPoint is not guaranteed for every document.
- Missing original fonts can change wrapping and layout. Export PDF on the original computer for a fixed appearance; embed fonts only when their licenses allow it.
- Encrypted or password-protected documents are not accepted. Save an unlocked copy or export PDF.
- Corrupt-file, password, busy and unavailable-converter errors are distinguished. Retry later when busy; contact your server owner when unavailable. PDF does not require the converter.

For live PowerPoint animation or video, start its slideshow and use Screen share, selecting its window and available audio. The direct connection to open PowerPoint controls has been removed from the menu. Choose PDF/PPTX for slide navigation through CastLink; test physical PowerPoint and audio before a broadcast.

[CastLink guide](GUIDE.md) · [Changelog](CHANGELOG.md)

Windows EXEs are unsigned. Updates require user consent and may restart the app or services; schedule a broadcast pause and save the data you need yourself. End-user servers create no automatic backups. Test physical devices, PowerPoint and your documents before going live.
