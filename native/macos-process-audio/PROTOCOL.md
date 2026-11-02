# macOS PowerPoint application audio

`ProcessAudio.swift` is a standalone ScreenCaptureKit helper for native arm64 and
Intel x86_64 macOS. ScreenCaptureKit audio requires macOS 13 or newer; the desktop
package can impose a higher minimum. This implementation is written for the macOS
15 SDK, including its explicit `captureMicrophone = false` setting. Compile and
interactive audio acceptance on both architectures remain required; Linux
transport tests do not prove OS capture or installed PowerPoint behavior.

Build on a native macOS runner (use `x86_64` for the Intel build):

```sh
xcrun swiftc -swift-version 5 -parse-as-library -O \
  -target arm64-apple-macos13.0 \
  native/macos-process-audio/ProcessAudio.swift \
  -framework AppKit -framework ScreenCaptureKit -framework CoreMedia \
  -framework CoreAudio -o resources/process-audio/CastLink.ProcessAudio
resources/process-audio/CastLink.ProcessAudio --self-test
```

The integration build script chooses the agreed deployment target and checks the
resulting Mach-O architecture. No Rosetta or Windows resource is used. The helper
must be included in the app's signing and Screen Recording permission flow.

## Commands and identity

The fixed executable accepts only:

- `--self-test`: bounded JSON with `protocol: "CLPA0001"`, `sampleRate: 48000`,
  `channels: 2`, `maxPacketFrames: 4800`. Verifies the wire ABI and runtime OS
  requirement. This does not request permission or assert audio was captured.
- `--probe <decimalCGWindowID>`: validates the live PowerPoint owner, returning
  `{windowId:string,pid:number,processStartTime:number}`. The start time is the
  application's launch date rounded to milliseconds since the Unix epoch.
  No title, document name, or bundle path is returned. This does not start audio.
- `--window <decimalCGWindowID> [--pid <decimalPID> --started <launchDateMs>]`:
  starts capture with explicit audio opt-in enforced in the Node adapter. Trusted
  main-process identity, when supplied, must agree exactly with native resolution.

Window IDs are nonzero UInt32 values, PIDs nonzero Int32. No shell, arbitrary
binary path, filter expression, microphone device, or audio endpoint is accepted.
The original `NSRunningApplication` object is retained. Its PID, launch date,
bundle identity (`com.microsoft.Powerpoint`), selected CGWindowID and current
owner are checked before stream startup, every delivered PCM packet, and by a
50 ms independent watchdog. A destroyed window, exited/reused PID, changed owner,
revoked screen permission, or exited parent closes the stream. No replacement
window or process is chosen. The trusted caller may provide the identity from
presentation binding; otherwise native resolves and pins it during startup.

ScreenCaptureKit uses `SCContentFilter(display:includingApplications:exceptingWindows:)` with
**exactly the selected owning application**, plus
`excludesCurrentProcessAudio = true`. A display intersecting the selected window
is only the required SCK filter anchor. No screen frames are forwarded. Only the
`.audio` stream output is registered, and microphone capture is disabled. There
is no system-wide or microphone fallback on failure. Scope is the selected
PowerPoint application's rendered audio; multiple presentations sharing that
application share its audio scope. This does not promise per-slide or per-document
mix separation.

Stdin EOF or any byte, SIGINT and SIGTERM request stop. The helper stops its own
SCStream and exits within one second even if the capture service fails to reply.
The Node adapter terminates its own child, escalating to SIGKILL after one second,
clears pending PCM, and ignores all late frames/callbacks. Independent camera and
microphone captures are not affected.

Exit 0 means normal stop, 3 unsupported macOS, 4 refused source/permission,
capture, malformed audio, or pipe failure. Stderr contains only fixed codes;
the product adapter never forwards native stderr to a renderer or remote peer.

## Binary stream

All numbers and float samples are little endian. The initial header is exactly
24 bytes, identical to the Windows CLPA0001 transport:

| Offset | Type | Value |
| --- | --- | --- |
| 0 | 8 ASCII bytes | `CLPA0001` |
| 8 | UInt32 | 48000 |
| 12 | UInt16 | 2 |
| 14 | UInt16 | 32 |
| 16 | UInt32 | pinned PowerPoint PID |
| 20 | UInt32 | reserved zero |

Each packet is UInt32 frame count (1–4800), then `frames * 8` interleaved stereo
Float32 bytes. SCK planar/interleaved Float32 is validated and serialized without
sample-rate conversion or synthesized audio. Unexpected formats and nonfinite
samples refuse capture. Native and Node pending buffers are bounded at 131072
bytes. Native stdout is nonblocking; backpressure beyond the bound or one second
ends capture so it cannot prevent identity/parent watchdog checks. EOF with a
partial header or packet is an error. No stdout diagnostic text is permitted.

`createProcessAudioAdapter` dispatches to the macOS implementation on darwin,
preserving `start({sourceId,enabled,onFrame,onError,onEnded}) -> {ready,stop}`.
It additionally accepts trusted `sourceIdentity` in main; this is never supplied
by a renderer. `probeMacProcessAudio()` is a bounded asynchronous native protocol
probe for capability discovery. File presence alone does not establish a valid
helper, screen permission, or successful live capture.

## Real native fixture and acceptance

```sh
node native/macos-process-audio/smoke.cjs \
  --helper resources/process-audio/CastLink.ProcessAudio
```

This compiles `ToneFixture.swift` and launches three separate owned AppKit apps
rendering real 440/880/1320 Hz audio through AVAudioPlayer. The selected QA app has
the PowerPoint bundle ID solely for the fixture; it is **not Microsoft Office**.
The other two apps have distinct bundle IDs. No native capture path is mocked or
replaced. The smoke runs the production helper and Node adapter, refuses the
foreign app window, requires selected 440 Hz audio with >50 dB rejection of both
competitors, verifies returned PID, and checks capture terminates when the source
process exits. It cleans up only its own apps and temporary files. Signing is
local ad hoc. It does not change TCC, prompt through System Settings, or use a
physical microphone.

Exit 3 and `NOT VERIFIED` mean the required real output device, GUI or Screen
Recording permission was unavailable. They must not be recorded as an isolation
PASS. Compilation, protocol, source rejection, spectral failure or cleanup bugs
exit 1. This fixture is an OS-isolation test; ordinary transport unit tests
are labeled as such and do not claim native isolation.

Required interactive acceptance on **both arm64 and Intel** still includes:

1. Installed PowerPoint plays a PPTX with embedded 440 Hz media while another app
   plays 880 Hz, a return-audio app plays 1320 Hz, and a physical microphone has a
   separate marker. Confirm only the PowerPoint marker reaches the remote
   `screen_share_audio` track, including independent share mute/unmute.
2. Multiple PowerPoint documents establish the documented application-wide scope.
   Closing the selected slideshow, exiting/restarting PowerPoint, source changes,
   screen permission revocation, sleep/lock and reconnect never retarget capture.
3. Stop, disconnect and picker cancellation end only owned audio promptly; camera
   and microphone continue independently. Switch Spaces/displays/fullscreen and
   confirm the retained source and native architecture remain correct.
4. Perform the same checks using the packaged and signed app/helper, recording
   source SHA, OS, native architecture, Office version and actual TCC outcome.

No native or installed Office acceptance has been run by the Linux source tests.
