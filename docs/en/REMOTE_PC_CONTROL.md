[Русский](../REMOTE_PC_CONTROL_RU.md) · [English](REMOTE_PC_CONTROL.md) · [简体中文](../zh-CN/REMOTE_PC_CONTROL.md)

# Screen sharing and PC control

This guide covers the candidate with built-in PC control. Control requires an updated CastLink server and the Windows client on the controlled PC. The controlling participant can use a browser or the client.

Press the screen-sharing button, choose a display or window and an available audio option. Sharing starts with an active indicator. Press again to stop. A browser uses its normal source picker.

Audio options depend on the browser, OS and client. The Windows client supports selected PowerPoint application audio; system audio and arbitrary window audio are unavailable in this mode. Giving control preserves the selected video and audio without another source picker.

## Give or request control

1. On the controlled PC, open the room in the Windows client and start sharing normally.
2. In the floating toolbar, select a participant and press **Give control**. The participant needs the appropriate room permissions.
3. The recipient clicks the video itself to enable input. One participant controls at a time; choosing another disables the previous access.

A recipient can open **PC control** beside the video and press **Request PC control**. The owner chooses **Allow** or **Deny**. A request alone grants no access. After approval, the recipient clicks the video.

This grants mouse and keyboard access to the **full PC**. Window sharing limits the picture, not authorization to that application. Share the display when using multiple applications. The owner's local mouse and keyboard remain usable; the pointer is shared.

For IME, CJK or other text, click the video first, then use **Committed text (including IME)** and **Send text**. Draft text is not sent. Browsers may intercept reserved shortcuts. Windows secure desktop and UAC are unsupported; clipboard synchronization and file transfer are outside this feature.

## Pause and finish

- The owner's **Reclaim control** and the recipient's **Finish controlling** stop remote input while preserving video and audio.
- Focus loss, a hidden tab, disconnection or invalid video geometry pauses input. After recovery, release held keys and pointer buttons, then click the video again.
- **Stop sharing** and **Ctrl + Alt + Shift + S** end the share and control. Call camera and microphone remain active. Use the button if the shortcut is unavailable.
- **Ctrl + Alt + Shift + F12** on the controlled PC stops remote input in an emergency while preserving sharing. After an emergency stop or loss of the built-in module, stop sharing and select the source again before giving new control.
- Closing the floating toolbar hides it. Use **Show stop panel** to reopen it.

Keep the room connected. Older clients retain ordinary sharing and explain the required update when control is attempted. PDF/canvas presentations generated inside CastLink use their own stop controls; PC control binds to a display or window selected in the client.
