# macOS remote input, main-only protocol v1

This is the macOS implementation of `../windows-remote-input/PROTOCOL.md`,
including `retireAuthority`. It accepts exactly the same fixed JSON-lines
commands and main-only lease proof; remote receiver data cannot select a target,
activate a grant, renew a lease or retire authority. Input lines are byte-bounded
to 16384 before parsing. The executable is `remote-input/CastLink.RemoteInput`.
`--permission-status` emits one JSON line `{screen,accessibility,inputMonitoring}`
with actual preflight booleans and exits0 without creating an event source/tap.
`--request-input-monitoring` explicitly calls CGRequestListenEventAccess, returns
that same post-request preflight schema, and creates no events. Only a deliberate
local permission action may invoke this request flag. Neither path binds a target
or grants input. An absent monitoring permission at bind returns the finite
`REMOTE_INPUT_MONITORING_PERMISSION` diagnostic.
There are no shell commands, AppleScript commands or renderer-supplied paths.

Main picker sources are `{kind:"window",windowId:"positive UInt32"}` and
`{kind:"screen",displayId:"positive UInt32"}`. Mapping rules are `macos-window`
and `macos-display`. A window binding resolves the CGWindowID to its owner PID,
kernel process-birth timestamp (`proc_pidinfo(PROC_PIDTBSDINFO)`), and one unique Accessibility window with the
same native frame. The exact AX element is retained, never looked up again by
user document title. A replaced PID, missing retained AX window, reused ID,
terminated app or divergent AX/CG frame fails closed. A display binding pins
CGDirectDisplayID plus display UUID; it never guesses a replacement monitor.
`start` with an existing capture can refresh its video size only.

`geometry.width/height` describe native backing pixels. `rect` describes global
Quartz desktop points, with top-left origin and possibly negative monitor
origins. Normalized coordinates are mapped to points, independently of capture
resolution. Whole capture extents allow exact pixels, odd-to-lower-even alignment,
and the same fixed whole-source 1920x1080 projection as Windows. Arbitrary aspect
ratios/crops are rejected. Window/display movement, resizing, backing scale,
readiness or visibility transitions increment revision, release holds and require
a fresh server lease and authenticated empty heartbeat. A same-size translating
window drag retains its initial mapping until mouse-up. Mixed-density spanning
windows pause until one consistent scale can be established.

The native process uses a Unix epoch anchored once to monotonic uptime. Every
lease must have 0 < remaining <=750ms. The independent 50ms watchdog releases on
lease expiry and 500ms receiver heartbeat silence, even while main continues
renewing server leases. Every OS input event additionally rechecks the current
monotonic authority immediately before posting. Reliable gaps, per-lane replay,
move barriers, stale geometry, mismatching held snapshots and malformed input
cannot produce input. Initial activation and every pause require a new serial
plus an empty authenticated heartbeat. EOF, Stop, reclaim and authority retirement
release remote holds. Retirement preserves the native source and its identity.

Accessibility and Screen Recording must be granted independently; this helper
never prompts or changes TCC. Input Monitoring must also be granted; a normal-user listen-only session event tap must be available. Physical holds are checked against HID system state.
Trust, active console session, lock/session/sleep notifications and tap availability
are rechecked during operation. A selected window must remain on the current Space,
not minimized, and be the focused window of the frontmost owner application.
Each pointer point must hit the selected CG window in the real front-to-back window
list; overlays and occluders are rejected. A display-sized tracking surface owned by
Apple's verified system Dock may be passed only at the observed Dock layers20/2006,
with a successful AX point query proving the exact bound owner and retained AX window.
The front-to-back scan then continues: another modal or unrelated window still blocks.
Dock code verification is cached only for its exact PID and kernel process birth.
Mouse button events use the authenticated point from that same command; asynchronous
cursor movement never causes a second global-cursor read. Cleanup uses the last
validated point of each remotely held button. Capturing a display permits the active
PC under the user's full-PC grant, within that selected display's geometry.

CGEvents carry a private marker. The listen-only session tap never swallows input or
logs text; owner key/button activity releases remote holds and requires receiver
resynchronization. Key/button release only affects holds created by this helper,
and skips any key/button still physically held by the owner. Ctrl+Alt+Shift+F8
is an additional native Stop path; normal owner UI remains the primary path.
Input uses physical Mac key positions and explicit modifier flags; text uses
bounded UTF-16 Unicode events, independent of keyboard layout. F1–F20 are native
macOS function keys; Windows-only F21–F24 have no documented macOS virtual-key
mapping and return REMOTE_INPUT_EVENT. PrintScreen/ScrollLock/Pause map to their
conventional Mac extended-key equivalents F13/F14/F15; OS-global shortcut behavior
is the macOS behavior. Secure desktop/login input is unsupported.

## Build and verification

On each actual architecture (arm64 and x86_64), with the pinned macOS SDK:

```sh
swiftc -parse-as-library ../macos-common/ProcessBirth.swift Core.swift RemoteInput.swift -framework AppKit -framework ApplicationServices -framework CoreGraphics -o CastLink.RemoteInput
swiftc -parse-as-library Core.swift CoreFixture.swift -o CoreFixture
./CoreFixture
swiftc -parse-as-library ../macos-common/ProcessBirth.swift Core.swift NativeFixture.swift -framework AppKit -framework ScreenCaptureKit -framework CoreGraphics -framework ApplicationServices -o NativeFixture
node native-fixture.cjs ./CastLink.RemoteInput ./NativeFixture ./artifacts/native-input.json
```

`CoreFixture` has no OS input and proves only the state machine. The native fixture
opens its own distinct synthetic app window, binds only that CGWindowID and sends
actual CGEvents after an explicit fixture grant. It measures received key/text and
pointer events, revoke key-up, replay denial, foreground/occlusion, geometry revision
and receiver timeout. It captures that real window using ScreenCaptureKit and
checks four colored corner markers plus the real backing extent, saving a PNG.
Missing permission or GUI/window identity is `NOT VERIFIED`, never a successful
OS input claim. `CASTLINK_REQUIRE_NATIVE_INPUT=1` makes unavailable permission fail.
The native fixture never grants TCC, changes other apps, or uses PowerPoint.

Physical held-key overlap, actual Space switching, multiple monitors with mixed
Retina density, alternate physical layouts and OS shortcut interception require
interactive acceptance on both architectures. The synthetic fixture does not
claim these physical checks. Evidence belongs to its source SHA, architecture,
permission state and capture artifact, not merely successful compilation.
