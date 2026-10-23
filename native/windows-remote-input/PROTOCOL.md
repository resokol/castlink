# Remote input, main-only protocol v1

`createRemotePcInputController({resourcesPath,onState})` starts the fixed
`remote-input/CastLink.RemoteInput.exe` without shell or command-line authority.
Only trusted main calls `bind`, `activate`, `renew`, `input`, `releaseAll`, `stop`.
The publisher cannot choose a source, mapping rule, grant or deadline.

`bind({captureId,source,video:{width,height},mapping:{kind}})` resolves native state.
Window source is `{kind:'window',hwnd:'positive Int64'}` from the trusted picker;
screen source is `{kind:'screen',rect:{x,y,width,height}}`, exact physical monitor
match, never nearest-monitor guessing. Rules are `dwm-frame` and `win32-monitor`.
The pinned capture backend rule MUST pass genuine captured-marker fixtures before
shipping. Size equality alone is a consistency check, not evidence of crop origin.
`geometry()` reads `{width,height,revision}`; `geometry({video})` refreshes only the
same binding's measured video dimensions, never retargets capture.

State: `{captureId,geometry,rect,ready,pointerReady,active,needsEmptyReset,error}`.
`ready` is source identity + Default desktop; `pointerReady` additionally requires
physical frame/video size consistency and visibility. Window video is not a PC
permission sandbox: keyboard/text target the active PC under the full-PC grant.
Pointer events must hit the exact visible captured window (children allowed).

`activate`/`renew` proof is `{grantId,revision,leaseSerial,captureId,
geometryRevision,expiresAt}`. Main must validate the HTTP response correlation and
derive the **local absolute** deadline from request start, never response delivery.
Maximum remaining time is 750ms. Both processes compare against monotonic clocks
anchored to Unix time once; queued renews retain their original deadline.
Serial must increase. New grant revision must increase. A fresh proof can rearm
the same grant; a revoked grant is never renewed by main. Receiver data cannot renew.

`input` takes the verified protocol frame from `remote-pc-protocol.ts`; main checks
sender SID, canonical HMAC, current session/generation/capture. Adapter strips MAC
and public routing fields, preserving native grant/capture/geometry/lane/seq/deadline
and event. Coordinates are integers 0..65535. Move and reliable seq are independent;
button/wheel barriers discard preceding moves. Native stdin lines <=16384 bytes.
Each command is `{id,op,...}`; commands only `start`, `renew`, `input`, `releaseAll`,
`stop`. `renew` has `activate:boolean`. Replies `{id,ok,state}` or finite
`{id,ok:false,error}`; unsolicited `{event:'state',state}`. No paths, text or raw
exceptions are returned or logged. No command builds a shell string.

Initial activation, reliable gap/expired transition, geometry change, receiver
timeout and blur release all remote holds and require a fresh server serial plus
authenticated **empty** heartbeat snapshot. Heartbeat every200ms includes unique
`pressedKeys` (<=32 DOM physical codes) and `pressedButtons` (<=3). Snapshot mismatch
releases; no snapshot synthesizes DOWN. Native heartbeat silence500ms releases
independently of the server750ms lease; watchdog checks every50ms. Neither heartbeat
nor input extends the server lease. EOF and Stop release; Ctrl+Alt+Shift+F12 is local
Stop. Low-level hooks observe physical holds, never block input or log text.

Known limits: one shared Windows cursor, normal same-user SendInput/UIPI;
secure desktop/Ctrl+Alt+Del unsupported. In-flight input already applied cannot
be undone. Genuine Windows timing, crop alignment, local held-key interaction,
captured drag, DPI and SendInput effectiveness remain release gates, not unit-test
claims. `CoreFixture.cs` uses a fake platform and makes no OS input calls.
