[Русский](../../PRESENTATIONS.md) · **English** · [简体中文](../zh-CN/PRESENTATIONS.md)

# Presentations: PDF and PowerPoint

[CastLink guide](GUIDE.md) · [Changelog](CHANGELOG.md)

**Presentations** is on the caster page. A caster opens a presentation on their computer and can let another selected caster in the same room switch slides. The owner can also navigate, take back control, or stop control.

**Slide control and image sharing are enabled separately.** To send the image to the studio, click Screen sharing and select the PDF tab or PowerPoint slide show window in the browser’s system picker. This uses normal browser `getDisplayMedia` capture: grant permission on your own computer. The helper does not enable screen capture, camera, or microphone.

## PDF in the browser

1. Update the room’s server and reopen the caster page while off air.
2. Under Presentations, choose **Open a PDF on this computer**. The limit is **100 MB**. The browser processes the file locally without uploading it to the server.
3. Check the page. Full screen expands the viewer; enable sharing of this tab separately.
4. Click **Allow PDF control**. Select another connected caster and click **Give control**. Previous and next page buttons appear for that caster.
5. Use **Take back control** or **Stop presentation control** when finished. Stopping control does not stop screen sharing; stop that separately.

This feature sends page control and presentation status, not the PDF itself. The other caster does not receive the file through this feature. The document name appears in presentation status.

## PowerPoint: experimental helpers

**Desktop Microsoft PowerPoint** must be installed on the presentation owner’s computer. The helpers do not target PowerPoint for the web or other applications. **They have not yet been tested with native PowerPoint on Windows or macOS; test them on your own computer before broadcasting.** PDF and screen sharing work independently of the helpers.

1. Start the PowerPoint slide show.
2. Click **Connect PowerPoint** on the caster page.
3. Download the helper **for your OS from the same updated CastLink server** that hosts the room. Do not use a different installation’s server address.
4. Run the helper on the PowerPoint computer. Enter the server’s HTTPS address and the one-time code from the caster page. Approve control of the selected slide show on that computer.
5. Wait for Connected. Select a connected caster and click **Give control**. Enable sharing of the PowerPoint window separately.

Download URLs follow this form. Replace `YOUR-CASTLINK-SERVER` with your server address; these are not GitHub documentation URLs:

```text
https://YOUR-CASTLINK-SERVER/helpers/CastLink-PowerPoint-Windows.ps1
https://YOUR-CASTLINK-SERVER/helpers/CastLink-PowerPoint-macOS.js
```

### Windows

Use **Windows PowerShell 5.1**, rather than PowerShell 7. Save the file in Downloads and run:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "$HOME\Downloads\CastLink-PowerPoint-Windows.ps1"
```

`-ExecutionPolicy Bypass` applies to this launch. Select the number of the already running slide show when prompted, and type `YES` to approve. Leave the window open. `Ctrl+C` stops the helper.

### macOS

Save the file in Downloads and run in Terminal:

```bash
osascript -l JavaScript "$HOME/Downloads/CastLink-PowerPoint-macOS.js"
```

Keep **exactly one** PowerPoint slide show open. If macOS asks for permission to automate PowerPoint, approve it so the helper can navigate the selected show. Close the helper or stop control in CastLink to finish.

## Expiration, stopping, and reconnection

- The connection code is single-use and valid for **120 seconds**. Create a new connection if it expires or has already been used.
- A control session lasts up to **30 minutes from creation**. Connect again after expiration. PDF control uses the same limits, with no manual code entry for the local PDF.
- Only **next/previous slide or page** is available. There is no cursor control, text entry, arbitrary keystroke, or arbitrary computer file access.
- After connection loss, the owner leaving, a different slide show, or a server restart, you may need a new connection. Old commands should not replay; wait for navigation confirmation before the next command.
- **Stop presentation control** revokes control. Stop image sharing with the separate screen sharing button. Do not give the code to unrelated people.

The initial-connection echo issue remains open. Yandex Browser on macOS and Wirecast have not been tested separately. Check audio, window capture, and receiving software on your own equipment before broadcasting.
