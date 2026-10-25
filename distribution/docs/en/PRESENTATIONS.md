[Русский](../../PRESENTATIONS.md) · **English** · [简体中文](../zh-CN/PRESENTATIONS.md)

# PDF, PPTX, and presentation control

Choose the [package and checksums for your track](PRODUCTS.md). Windows Client joins an existing server; Windows Server Setup and Linux install a server. Ordinary participants need a supported browser and HTTPS.

## Prepare a file

1. Choose **Upload PPTX or PDF**. Each file is limited to **1,500,000,000 bytes**.
2. PDF prepares in the browser; PPTX uploads to your server and converts to PDF in an isolated converter. This method does not require an installed PowerPoint application.
3. Wait for preparation. The file-name button opens **Who will control**, **Share presentation**, and **Delete file**. Uploading and selecting a controller do not yet start sharing or grant remote access.
4. Choose **Share presentation** as a separate action. The document is sent as a separate video stream with no audio. Stop a conflicting screen share first if the interface requests it.

## Slide navigation and stopping

During a live presentation, use Previous / Next and the control menu. The owner can delegate navigation, reclaim it, and stop the share; the owner's own navigation buttons remain available. If the slide already changed and a command conflicts, check the current slide and explicitly retry.

Stopping ends the live share; the prepared file remains available to share again or delete. Closing a menu or panel is not Stop. If stopping fails, check the state and retry the explicit action.

Compact controls are available in the room. A supported floating browser window opens after your action; if Document Picture-in-Picture is unavailable or denied, use the in-room panel. An available native panel takes priority in the Windows client. Do not rely on a large red browser window opening automatically.

## Slides, live PowerPoint, and PC control

Prepared PDF/PPTX shows static pages: original PPTX animations, music, and video do not play in this mode. To share original PowerPoint with animation/audio, run it on your PC and select its window and available audio in screen sharing. Test physical PowerPoint, fullscreen behavior, and audio before broadcasting.

Slide controls navigate the selected presentation. **PC control** on a Windows-client share provides full PC mouse and keyboard access after separate consent, even when only one window is visible. Uploading a file does not turn ordinary browser sharing into PC control. [Requests, revocation, and pause reasons](GUIDE.md#pc-control).

## Compatibility and limits

- Update the server and converter with the matching complete server package; update the client separately. The converter has a 2 GiB memory limit; allow at least 8 GB of free working-disk space as a guideline. The file-size limit does not guarantee processing every document.
- Check page count, fonts, and layout after preparation. For an exact appearance, export PDF on the original computer; embed fonts only when their license allows it.
- Encrypted or password-protected documents are rejected. Use an unprotected copy or a PDF export.
- Retry later when the converter is busy; contact the server owner when it is unavailable. PDF does not need the PPTX converter.

[Full guide](GUIDE.md) · [Packages and checksums](PRODUCTS.md) · [Changelog](../../../CHANGELOG.md)
