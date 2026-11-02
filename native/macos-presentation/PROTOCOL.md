# macOS presentation adapters

The desktop main process owns all paths, native window IDs and binding tokens.
The renderer receives the existing prepared ID / grant ID / finite status API.
Disconnect disposes authority only: it never closes Office, saves a document,
ends a user's show or converts PPTX to PDF.

## Resources and build

Compile each helper together with `native/macos-common/ProcessBirth.swift` using
the macOS SDK, `-parse-as-library`, target macOS 13+
and the selected architecture (arm64 or x86_64). Both files have `@main` entry
points. Link AppKit, ApplicationServices and CryptoKit. Stage:

| Source | Relative resource path |
| --- | --- |
| `WindowSlides.swift` | `window-slides/CastLink.WindowSlides` |
| `PowerPointIdentity.swift` | `powerpoint/CastLink.PowerPointIdentity` |
| `PowerPoint.js` (fixed JXA source, copied) | `powerpoint/PowerPoint.js` |

Run each native executable with `--self-test` for a permission-independent
protocol probe. Its `osOperationVerified:false` is intentional: compilation and
argument parsing cannot prove an Accessibility effect. The PowerPoint probe
also exercises the real native keypad encoder, including unsupported-character
refusal, plus sheet/dialog/unknown-focus metadata refusal; it does not send
keyboard events. Missing required AX children/role/window-subrole metadata is
a refusal, not an empty or safe-tree fallback. Validate JXA syntax using
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
requires a successful bounded read of the selected window’s direct AX children,
refuses sheet/dialog roles in those children or anywhere along focus ancestry,
requires AXStandardWindow metadata for window nodes, refuses held modifiers,
then sends bounded numeric-keypad digit key pairs
and Return directly to that process. JXA polls the actual slide index and
acknowledges only the requested resulting slide before the short deadline.
Unexpected results revoke authority; the shortcut is never retried.

Public independent evidence reports a typed-digit shortcut failure on one Office
installation (the digit was dropped while Return advanced):
https://github.com/adbertram/cli-tools/blob/d8b18152a28a6c07ff7a54ab1e30f7b8877799a0/_repo/skills/powerpoint-slide-recorder-cli/SKILL.md
This adapter uses numeric-keypad keycodes (`kVK_ANSI_Keypad0` through
`kVK_ANSI_Keypad9`) with numeric-pad event flags, avoiding US top-row digit
assumptions on layouts such as French AZERTY. Its native self-test validates all
ten numeric codes and refuses punctuation/non-ASCII digit mappings. It verifies
the actual slide result, but
its compatibility still requires a real Office fixture. It is not verified
parity until the target versions/architectures pass.

`CastLink.PowerPointIdentity` accepts only one bounded JSON argument. It joins
scripting show geometry to exactly one public AX window with the same canonical
AXDocument URL and exactly one public CGWindow in the PowerPoint process. It
never equates a scripting window index to a capture ID. Ambiguous geometry,
missing AXDocument or absent permissions refuse the operation. A SHA-256 token
binds kernel process birth milliseconds/PID, CGWindowID, canonical document URL and filesystem
resource/volume identifiers. Window capture must match Electron's main-owned
CGWindowID; screen/browser capture requires a unique show plus local consent.

## PDF / external window

`macos-window-slides.cjs` keeps the selected-window protocol and opaque IDs.
Supported application adapters are Preview, Google Chrome and Microsoft Edge.
Browser PDFs require both their exact original `.pdf` AXURL and the browser's
built-in PDF viewer AXWebArea in the same ancestry chain. A title or an HTML
page at a `.pdf` URL is insufficient. There is no arbitrary-HTML fallback.

The desktop owns one `CastLink.WindowSlides --server` process. Its bounded JSON
line protocol carries `{requestId,args}` and replies `{requestId,value}`. Args
are finite `list`, `status|activate <CGWindowID> <binding>`, or
`step <CGWindowID> <binding> next|previous <deadlineMilliseconds>`. Native output
and JS input/output buffers are bounded, requests are serial, and cancellation,
EOF, timeout or controller disposal ends the broker. Parent-lifetime checks
refuse effects after the desktop dies. Direct CLI mode remains available for
Preview diagnostics; browser authority requires the retained-reference broker.

The broker retains real public AXWindow/original-document/viewer references.
A binding is a fresh opaque token tied to those references, PID/kernel birth timestamp,
CGWindowID and canonical document URL. Replacing a tab with the same URL cannot
reuse its previous AX document/viewer identity. AXTree or URL changes invalidate
the token; they are not resolved by matching titles or reselecting another tab.
The public status remains name/kind only; page counts are not fabricated.

Chrome's built-in viewer ID comes from its public manifest/key. For Edge, and
for additional installed Chromium PDF viewer identities, the adapter inspects
only the installed browser bundle's framework `.pak` resources (at most 16 direct files per candidate resource
directory, 64 MiB each and 128 MiB total). Its bounded
DataPack v4/v5 parser validates every offset. A resource qualifies only with the
`application/pdf` MIME handler, `index.html`, the `pdfViewerPrivate` permission
and an embedded public key. The extension ID is derived from that key using
Chromium's SHA-256 nibble algorithm. Arbitrary installed/user extensions and
lookalike extension URL hosts never qualify. Unsupported proprietary viewer
formats remain unavailable rather than accepting guessed extension IDs.

The helper reads the browser application AXRole to request normal native
accessibility, following Chromium’s public AXRole activation path; it does not
set private AX activation attributes or user browser flags/preferences.
The public AX traversal is capped at 1,024 nodes, depth 32 and 256 children per
node. It skips PDF text content after finding sufficient identity evidence, so
large documents do not require scanning every page. Exactly one proven PDF
viewer must be present. The helper requires Accessibility permission and a
unique CGWindow/AX geometry match in the selected process. Preview additionally
requires a local PDF AXDocument URL.

Activation follows explicit local consent only. Every step revalidates identity,
foreground application, focused window and PDF-content ancestry twice before
sending a PageDown/PageUp pair directly to the selected process. Editable fields,
address bars, search, combo boxes, sheets, dialogs, other viewer roots and held
modifiers are refused. Events have explicit empty modifier flags; no global key
is posted and navigation never steals focus.

Run `CastLink.WindowSlides --browser-fixture` on macOS for the real optional
browser fixture. It discovers installed Chrome/Edge, checks existing
Accessibility permission without prompting, and launches each browser in a
new owned temporary profile with a generated two-page PDF. It exercises actual
AX document recognition, bounded navigation with an observable scroll/text
position change, editable-control refusal and same-URL tab replacement. It closes only
its owned browser process and removes only its temporary profile. No user
browser profile, account or document is used. Missing browsers/permissions and unobservable effects are explicitly
`NOT VERIFIED`; an installed browser with granted Accessibility that cannot
bind the known fixture PDF is `FAILED`. That failure records bounded stage
proofs and AX role/subrole/URL structure from only the owned fixture process.
URLs are reduced to scheme, host and extension; only the synthetic filename is
retained, never paths, queries, fragments, text values, titles or user tabs.
Successful input acknowledgement alone is never navigation proof. `--self-test` separately exercises pure URL/viewer/key/pack/focus contracts
without browser launch or input.

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
- Live goto, including multiple digits and US/French AZERTY/German layouts; no success until
  the actual requested slide is observed. Unexpected shortcuts must revoke.
- Selected window versus editor/presenter view, two open decks, changed capture,
  closed/restarted Office, fullscreen/Spaces and moved/Retina display geometry.
- Preview/Chrome/Edge PDF foreground content versus address/search/sidebar/dialog, same-URL tab replacement, replaced PDFs,
  permission denial/regrant and deadline/disconnect during a pending operation.

The development Linux environment has no Office/macOS SDK. Official installer
metadata was located through Homebrew's public microsoft-powerpoint cask, but
both the fwlink host and current Microsoft CDN returned CONNECT 403 under the
managed network policy. The source dictionary listing above is independent
public evidence; it does not replace the installed dictionary or live fixtures.
