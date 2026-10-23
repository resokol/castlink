[Русский](../REMOTE_PC_CONTROL_RU.md) · [English](REMOTE_PC_CONTROL.md) · [简体中文](../zh-CN/REMOTE_PC_CONTROL.md)

# Control a computer from your browser

**Screen sharing update — 23 October 2026.** Download and run the current installer below again if you installed an earlier component. The update fixes Windows browser launch registration and adds a floating controls panel above your presentation. Then refresh the room page and select “Start sharing”. The full client does not need reinstalling.

Install the [CastLink component](https://castlink.ru/general/screen-share-component/CastLink-Screen-Share-Setup.exe) on the Windows computer being controlled. The controller only needs a browser. The computer owner can also use a browser; the local component executes Windows commands in the background.

1. Click “Screen sharing”. Confirm opening CastLink if your browser asks.
2. Choose a screen or application window. A compact floating controls panel appears above other applications when sharing starts and stays available while you work in PowerPoint or another program.
3. In the floating panel, select another caster and click “Give PC control”. No second permission request or Accept button is needed.
4. The controller clicks the video to direct mouse and keyboard input to it. Use the “PC input” menu to send text.

Keep the room tab open and connected to give or reclaim control. If that connection is lost, those panel actions become unavailable; local Stop remains available.

The owner's local mouse and keyboard keep working. Both people share one cursor. Window sharing shows only the selected window; control includes access to the PC keyboard. Share the entire screen when working across applications.

“Reclaim PC control” disables remote input while keeping video active. “Stop sharing” ends video and control. On the controlled computer, **Ctrl + Alt + Shift + F12** stops sharing. Input pauses when the connection is lost; release held keys and mouse buttons before resuming.

PowerPoint keeps running on the owner's computer with its effects. Full PC control requires no presentation upload or conversion. The server and controller computers need no reinstall.

The browser offers “Download sharing component” when starting a share. Install it once, return to the room and select “Start sharing”. Downloading and installation require your action. The full client is not needed. The component starts only for a share and exits after Stop or source-picker cancellation; there is no startup entry or persistent service. It ends sharing after30seconds without server authority, while input permissions expire independently within750ms. Source selection has a120second startup limit. Installation does not start a share automatically.
