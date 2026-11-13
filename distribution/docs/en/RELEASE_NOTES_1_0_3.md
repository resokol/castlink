# Microphone processing — 1.0.3

[Русский](../../RELEASE_NOTES_1_0_3.md) · [English](RELEASE_NOTES_1_0_3.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_3.md)

Noise suppression and echo cancellation are off by default. An explicitly saved choice is preserved. Microphone settings combine both functions in one switch. The primary studio can change it in the caster card without manual caster confirmation; the application automatically reports the result. Switching preserves a muted microphone and private talkback.

Guest cards retain measured incoming video/audio bitrates and the network grade.

Update Windows Server Setup or Linux off air, selecting the existing installation, then reload studio and caster pages. Windows Client stays at 1.0.0 and displays its selected server’s interface. Existing server installations require an explicit owner update.

Windows/WSL2 packages remain separate candidates; this release does not promote them to stable.

Build: `1.0.3-1a26de9f6f59` · source: `1a26de9f6f59cc95e84708e6e259bc0503daae38`
