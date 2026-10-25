[Русский](../REMOTE_PC_CONTROL_RU.md) · [English](REMOTE_PC_CONTROL.md) · [简体中文](../zh-CN/REMOTE_PC_CONTROL.md)

# Screen sharing and PC control

Control requires an updated CastLink server and the Windows client on the controlled PC. The controlling participant can use a browser or the client. This feature is published; current packages are listed in [Products](../../distribution/docs/en/PRODUCTS.md).

Press the screen-sharing button, choose a display or window and an available audio option. Sharing starts with an active indicator. Press again to stop. A browser uses its normal source picker.

Audio options depend on the browser, OS and client. The Windows client supports selected PowerPoint application audio; system audio and arbitrary window audio are unavailable in this mode. Giving control preserves the selected video and audio without another source picker.

## Give or request control

1. On the controlled PC, open the room in the Windows client and start sharing normally.
2. Open **Control** in the compact floating toolbar and select a participant under **Give control**. The participant needs the appropriate room permissions. The menu opens when you choose it; the toolbar shows the selected source name and a separate stop-sharing button.
3. The recipient clicks the video itself to enable input. One participant controls at a time; choosing another disables the previous access.

A recipient can open **PC control** beside the video and press **Request PC control**. The owner chooses **Allow** or **Deny**. A request alone grants no access. After approval, the recipient clicks the video.

This grants mouse and keyboard access to the **full PC**. Window sharing limits the picture, not authorization to that application. Share the display when using multiple applications. The owner's local mouse and keyboard remain usable; the pointer is shared.

For IME, CJK or other text, click the video first, then use **Committed text (including IME)** and **Send text**. Draft text is not sent. Browsers may intercept reserved shortcuts. Windows secure desktop and UAC are unsupported; clipboard synchronization and file transfer are outside this feature.

## Pause and finish

- The owner's **Reclaim control** and the recipient's **Finish controlling** stop remote input while preserving video and audio.
- Focus loss, a hidden tab, disconnection or invalid video geometry pauses input. After recovery, release held keys and pointer buttons, then click the video again.
- An input pause preserves the server's control grant. The owner does not need to approve again while access remains granted and the participants remain in the same session. Hovering over video letterboxing with no pointer button held and ordinary grant renewal no longer reset input.
- **Stop sharing** and **Ctrl + Alt + Shift + S** end the share and control. Call camera and microphone remain active. Use the button if the shortcut is unavailable.
- Use **Reclaim control** to stop input and **Stop sharing** to end the share. Delivery of the additional **Ctrl + Alt + Shift + F8** shortcut was not verified by the automated check; the cause is unknown. Do not rely on it as the only way to disconnect control. After the built-in module ends, stop sharing and select the source again before giving new control.
- Closing the floating toolbar hides it. Use **Show stop panel** to reopen it.

Keep the room connected. Older clients retain ordinary sharing and explain the required update when control is attempted. PDF/canvas presentations generated inside CastLink use their own stop controls; PC control binds to a display or window selected in the client.
