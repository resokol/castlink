# macOS presentation adapters

The desktop main process owns all paths, native window IDs and binding tokens.
The renderer receives the existing prepared ID / grant ID / finite status API.
Disconnect disposes authority only: it never closes Office, saves a document,
ends a user's show or converts PPTX to PDF.

## Resources and build

Build each Swift source with the macOS SDK, `-parse-as-library`, target macOS 13+
and the selected architecture (arm64 or x86_64). Both files have `@main` entry
points. Link AppKit, ApplicationServices and CryptoKit. Stage:

| Source | Relative resource path |
| --- | --- |
| `WindowSlides.swift` | `window-slides/CastLink.WindowSlides` |
| `PowerPointIdentity.swift` | `powerpoint/CastLink.PowerPointIdentity` |
| `PowerPoint.js` (fixed JXA source, copied) | `powerpoint/PowerPoint.js` |

Run each native executable with `--self-test` for a permission-independent
protocol probe. Its `osOperationVerified:false` is intentional: compilation and
argument parsing cannot prove an Accessibility effect. Validate JXA syntax using
`osacompile -l JavaScript -o /tmp/CastLink.PowerPoint.scpt PowerPoint.js`.

## PowerPoint

`macos-powerpoint.cjs` preserves the Windows adapter's lifecycle, generation
checks, finite command consumption and main-owned capture binding. It invokes
only `/usr/bin/osascript -l JavaScript <fixed PowerPoint.js> <one JSON argument>`.
The supported operations are start/status/goto/step. A dedicated process group
is terminated on timeout/revocation, including any native child; native goto
also refuses to start after losing its Automation parent. Error envelopes are parsed
regardless of osascript exit code; private stdout/stderr never becomes UI text.

Prepare only selects the original PPTX through Electron's local file picker.
Start opens that original document, reuses its already-running show if unique,
or invokes the dictionary's `run slide show` on that document's settings.
Status and next/previous use the selected show's `slideshow view`, not the
active editor. Optional click counts are not fabricated: this dictionary does
not expose the Windows click-index/count API.

The installed `PowerPoint.sdef` is read without starting Office, and required
terms are checked before Automation. Dictionary evidence for the implemented
terms is the public generated listing:
https://github.com/jiweiqi/applescript-hub/blob/58bb8bc0859437af1f5f9cf809e0f6b0b2121d7c/app-dictionaries/microsoft-powerpoint.md
It exposes `slide show window.slideshow view`, `left position`, `presentation`,
`bounds`, and the `run slide show`, `go to next slide`, `go to previous slide`
commands. This evidence is a terminology check, not an Office runtime test.

PowerPoint's `go to slide` AppleEvent takes an editor `view` and a `number`;
it is never sent to a slideshow view. Live goto instead uses the documented Mac
slideshow numeric-key + Return shortcut:
https://support.microsoft.com/en-us/office/use-keyboard-shortcuts-to-deliver-powerpoint-presentations-1524ffce-bd2a-45f4-9a7f-f18b992b93a0
The native helper revalidates exact process/window/document binding, requires
that selected slideshow to be foreground with noneditable content focused,
refuses sheets and held modifiers, then sends bounded physical digit key pairs
and Return directly to that process. JXA polls the actual slide index and
acknowledges only the requested resulting slide before the short deadline.
Unexpected results revoke authority; the shortcut is never retried.

Public independent evidence reports a typed-digit shortcut failure on one Office
installation (the digit was dropped while Return advanced):
https://github.com/adbertram/cli-tools/blob/d8b18152a28a6c07ff7a54ab1e30f7b8877799a0/_repo/skills/powerpoint-slide-recorder-cli/SKILL.md
This adapter uses physical digit keycodes and verifies the actual result, but
its compatibility still requires a real Office fixture. It is not verified
parity until the target versions/architectures pass.

`CastLink.PowerPointIdentity` accepts only one bounded JSON argument. It joins
scripting show geometry to exactly one public AX window with the same canonical
AXDocument URL and exactly one public CGWindow in the PowerPoint process. It
never equates a scripting window index to a capture ID. Ambiguous geometry,
missing AXDocument or absent permissions refuse the operation. A SHA-256 token
binds process launch date/PID, CGWindowID, canonical document URL and filesystem
resource/volume identifiers. Window capture must match Electron's main-owned
CGWindowID; screen/browser capture requires a unique show plus local consent.

## PDF / external window

`macos-window-slides.cjs` keeps the selected-window protocol and opaque IDs.
The native helper supports Preview PDF windows. It does not claim Acrobat,
browser tabs, arbitrary documents or unverified PDF applications are equivalent.

Arguments are fixed finite operations: `list`, or `status|activate <CGWindowID>
<binding>`, or `step <CGWindowID> <binding> next|previous <deadlineMilliseconds>`.
All responses are a bounded JSON target or finite error envelope. Public status
contains a name and kind only; page/page-count claims are not invented.

The helper requires Accessibility permission and a unique CGWindow/AX geometry
match owned by Preview, with a local PDF AXDocument URL. The token binds process
launch date/PID, CGWindowID and exact document URL. Activation follows explicit
local consent only. A step additionally requires the exact selected foreground
window and a focused PDF content AXScrollArea/AXLayoutArea descended from it.
Search fields, sidebars, dialogs and other apps are refused. Revalidation occurs
immediately before process-targeted PageDown/PageUp key pairs; no global event
is posted and navigation never steals focus.

## Permission and verification states

Accessibility/Automation denial is a finite actionable error. The helper never
changes TCC, auto-approves permissions, purchases/activates Office or bypasses a
license dialog. The normal macOS Privacy & Security settings govern permission.

Linux JS contract tests prove opaque identities, transport bounds, finite error
normalization, deduplication, deadlines, ambiguous-start consumption, generation
cancellation, capture replacement and the JXA dispatch/observation contract.
They do not prove real Office commands, show identity metadata, key behavior or
Preview AX trees. Required real fixtures on both architectures include:

- Original PPTX with same-slide animations, forward/backward builds and media;
  original document prepare/start and exact status after owner navigation.
- Live goto, including multiple digits and keyboard layouts; no success until
  the actual requested slide is observed. Unexpected shortcuts must revoke.
- Selected window versus editor/presenter view, two open decks, changed capture,
  closed/restarted Office, fullscreen/Spaces and moved/Retina display geometry.
- Preview PDF foreground content versus search/sidebar/dialog, replaced PDFs,
  permission denial/regrant and deadline/disconnect during a pending operation.

The development Linux environment has no Office/macOS SDK. Official installer
metadata was located through Homebrew's public microsoft-powerpoint cask, but
both the fwlink host and current Microsoft CDN returned CONNECT 403 under the
managed network policy. The source dictionary listing above is independent
public evidence; it does not replace the installed dictionary or live fixtures.
