# PowerPoint process audio helper

Experimental Windows x64 helper. Native compilation and real capture must pass
before enabling it in a distributed build. It requires Windows build 20348 or
newer; this does not imply support for released Windows 10 consumer builds.

The helper accepts a selected external window handle and verifies that its live
owner is `POWERPNT.EXE`. It activates `VAD\Process_Loopback` with
`AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` and
`PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE`. It never enumerates audio
endpoints, opens microphone capture, uses exclusion mode, or falls back to system
audio. Scope is the **PowerPoint process and descendants**: multiple presentations
in that process share the same audio scope. Audio rendered by an embedded
PowerPoint component is part of this scope.

Implementation references, read for this implementation:

- [Microsoft ApplicationLoopback sample](https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/ApplicationLoopback/cpp/LoopbackCapture.cpp), blob `6a71de5081100ed12a0309725cea7bfa610e9ad5`.
- [ActivateAudioInterfaceAsync](https://learn.microsoft.com/en-us/windows/win32/api/mmdeviceapi/nf-mmdeviceapi-activateaudiointerfaceasync).
- [Activation parameters](https://learn.microsoft.com/en-us/windows/win32/api/audioclientactivationparams/ns-audioclientactivationparams-audioclient_activation_params).
- [Win32 COM interface definitions](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/mmdeviceapi.idl), blob `d6f91bdc3b10b05d24c0162c230b41ecd33d3cff`.

## Build and native gates

On the authorized Windows build machine, from repository root:

```powershell
node apps/desktop/scripts/build-process-audio.cjs C:\QA\process-audio\CastLink.ProcessAudio.exe
& C:\QA\process-audio\CastLink.ProcessAudio.exe --self-test
& C:\QA\process-audio\CastLink.ProcessAudio.exe --probe 123456
```

Use the actual decimal HWND from the explicit picker. `--self-test` checks x64 ABI
sizes and OS build; it does not capture audio. `--probe` validates a live PowerPoint
window without starting capture. A random HWND, non-PowerPoint window and destroyed
window must refuse with exit 4 and generic stderr. Unsupported Windows refuses
with exit 3. Neither probe proves actual audio support.

Package the executable at
`resources/process-audio/CastLink.ProcessAudio.exe`. The Node adapter launches only
this fixed path with `--window <decimalHWND>`, and no shell. It requires an explicit
audio checkbox. Capture data is written only to stdout; stdin EOF or any byte
requests stop. Window destruction, process exit and lost ownership terminate the
helper. Node `stop()` terminates only its own helper and ignores late frames.

## Pipe protocol

All integers and samples are little endian. The fixed 24-byte startup header is:

| Offset | Type | Value |
| --- | --- | --- |
| 0 | 8 ASCII bytes | `CLPA0001` |
| 8 | uint32 | sample rate 48000 |
| 12 | uint16 | channels 2 |
| 14 | uint16 | float bits 32 |
| 16 | uint32 | verified PowerPoint PID |
| 20 | uint32 | reserved 0 |

Each packet is `uint32 frameCount` followed by `frameCount * 8` interleaved
stereo float32 bytes. Frames must be 1–4800. Silent WASAPI buffers become zero PCM.
The Node adapter bounds incomplete input to 128 KiB and refuses unexpected format,
size or startup timeout. No stdout logs are permitted. Native stderr contains only
fixed stage/refusal strings and numeric HRESULT codes; the product adapter consumes
them without forwarding paths or diagnostics to renderers.

For an Office-independent native isolation smoke on Windows:

```powershell
node apps/desktop/tests/windows-process-audio-smoke.cjs --helper C:\QA\process-audio\CastLink.ProcessAudio.exe
```

This compiles three owned WinForms/WinMM tone players in a temporary directory,
uses an ordinary `POWERPNT.exe` fixture as the selected 440 Hz source, and renders
880/1320 Hz in two separate competing processes. It captures for 3.2 seconds and
requires the selected component plus at least 50 dB rejection of competitors,
then terminates only its own child processes. It needs a usable render endpoint.
This verifies the real WASAPI inclusion boundary with QA executables; it does not
verify installed Microsoft Office, actual private talkback or a physical mic.

## Real acceptance proof

1. Open a test PPTX that renders a known 440 Hz tone in PowerPoint. Select its
   explicit window and start helper capture. Parse header/packets and confirm
   stereo 48 kHz float32 plus the 440 Hz component in a recorded interval.
2. Concurrently render 880 Hz through the CastLink private/return output, and
   1760 Hz through an unrelated application. Feed a distinguishable 1320 Hz signal
   into the microphone. Measure all four frequencies in raw helper PCM and the
   actual remote `screen_share_audio` track. Only the PowerPoint tone may appear;
   report measured levels and noise floor rather than declaring isolation from
   process/protocol tests.
3. Verify camera/microphone tracks remain live when display STOP ends PowerPoint
   audio. Also verify share mute gates generated audio before publication.
4. Stop through display-track ended, navigation, renderer crash and adapter
   disposal; each must terminate the helper and discard late packets. Destroy
   the selected window and exit PowerPoint while keeping Node alive; both must
   end capture. Close the parent so its stdin pipe reaches EOF; no orphan helper
   may remain. Repeated starts must not overlap captures.
5. Record behavior when PowerPoint starts another presentation or delegates
   playback to a process outside its tree. Silence/refusal must stay explicit;
   it must never trigger endpoint or microphone capture.

Use distinct fixtures and test participants. Mock streams and parser tests prove
only the adapter contract; successful native build proves only compilation.
