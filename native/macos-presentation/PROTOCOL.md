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

Chrome's built-in viewer ID comes from its public manifest/key. The same exact
viewer origin was observed in the owned Edge fixture (native run ad3adaa), and
is accepted only inside the exact Chrome/Edge bundle identity. Entrypoints are
restricted to `/index.html` and the owned Edge fixture's verified
`/edge_pdf/index.html` (run 43fb); other resource paths remain refused. For additional
installed Chromium PDF viewer identities, the adapter inspects
only the installed browser bundle's framework `.pak` resources (at most 16 direct files per candidate resource
directory, 64 MiB each and 128 MiB total). Its bounded
DataPack v4/v5 parser validates every offset. A resource qualifies only with the
`application/pdf` MIME handler, `index.html`, the `pdfViewerPrivate` permission
and an embedded public key. The extension ID is derived from that key using
Chromium's SHA-256 nibble algorithm. Arbitrary installed/user extensions and
lookalike extension URL hosts never qualify. Unsupported proprietary viewer
formats remain unavailable rather than accepting guessed extension IDs.

AX application reads use a 750 ms message timeout and cache each process's
window list once per scan, avoiding repeated 100 ms startup timeouts. The owned
fixture separately records launch/AX readiness, retries with bounded 100–800 ms
backoff for at most 30 seconds for application AX readiness. Application readiness requires `isFinishedLaunching` as well as successful AX
role/window reads. Once AX is ready,
it gives the PDF renderer a separate six-second content phase, with a hard
36-second total binding bound, and pumps the run loop. This prevents a late
application startup from consuming the entire PDF-loading deadline. An installed,
permitted browser that never binds still fails.
The helper reads the browser application AXRole to request normal native
accessibility, following Chromium’s public AXRole activation path; it does not
set private AX activation attributes or user browser flags/preferences.
The public AX traversal is capped at 1,024 nodes, depth 32 and 256 children per
node. It prunes text content only at a trusted viewer AXWebArea below an original
PDF AXWebArea; an outer AXGroup carrying a PDF URL is traversed, since actual
Chrome/Edge use that group for the entire browser UI. This avoids scanning
all PDF text after finding sufficient identity evidence, so
large documents do not require scanning every page. Exactly one proven PDF
viewer must be present. The helper requires Accessibility permission and a
unique CGWindow/AX geometry match in the selected process. Preview additionally
requires a local PDF AXDocument URL and exactly one AXGroup with subrole
AXSharedDocumentContainer containing direct AXPage children whose AXParent
returns that container. Page children are sampled through bounded public AX
array APIs, so a large PDF need not enumerate every page. The retained root is
that document container, not the entire window. Preview focus may be the exact
container, a noneditable page descendant whose ancestry includes AXPage and the
container, or its nearest proven PDF ScrollArea/LayoutArea ancestor. Generic
groups, sidebars and the window itself cannot satisfy this proof; editable and
modal ancestry remains refused.

Activation follows explicit local consent only. Every step revalidates identity,
foreground application, focused window and PDF-content ancestry twice before
sending a PageDown/PageUp pair directly to the selected process. Editable fields,
address bars, search, combo boxes, sheets, dialogs, other viewer roots and held
modifiers are refused. Events have explicit empty modifier flags; no global key
is posted and navigation never steals focus.

Run `CastLink.WindowSlides --browser-fixture` on macOS for the real optional
browser fixture. It discovers installed Chrome/Edge, checks existing
Accessibility permission without prompting, and launches each browser in a
new owned temporary profile with a generated two-page PDF. Only that empty
profile gets Chromium's `--use-mock-keychain` (Apple
testing flag preventing host-keychain blocking dialogs) and
`--disable-search-engine-choice-screen` (documented testing/automation flag).
The PDF extension and browser security boundaries stay enabled.
`--enable-automation` is omitted: Chromium's process-singleton callback rejects
URL handoff when either instance has that switch, defeating the same-URL tab
fixture, and its infobar is not a blocking prompt. The replacement proof now
requires an actually new same-window/same-document AX root/viewer before
checking stale authority, and records the secondary process exit.
https://github.com/chromium/chromium/blob/main/chrome/browser/chrome_browser_main.cc
`--password-store=basic` is Linux-specific and is not used as a macOS fix.
Upstream references:
https://github.com/chromium/chromium/blob/main/components/os_crypt/common/os_crypt_switches.h
https://github.com/chromium/chromium/blob/main/components/search_engines/search_engines_switches.cc Only after verifying its owned PID, window and
viewer ancestry does the fixture focus the inner PDF web area using a bounded
process-targeted mouse pair. Activation is awaited for at most two seconds,
with finite frontmost/focused-window/role and content/window/intersection
geometry diagnostics. After its single content click it awaits focus for at
most two further seconds before any navigation, without retrying PageDown. The fixture may send one process-targeted Escape only
when the focused dialog is proven to belong to its own browser PID and AX
window/ancestry. The observed Intel Chrome AXUnknown alert window with one
direct AXApplicationAlertDialog child is also recognized when its focused UI
element is unavailable. The one-Escape budget is shared across activation and
post-click recovery and final pre-navigation readiness; it never approves a prompt or sends input to external/system
prompts. Production focus guards are unchanged. It waits up to twelve seconds for three consecutive stable baseline reads
and up to four seconds for resulting content change in only the retained trusted viewer subtree. The baseline must be stable
for three consecutive observations; sample/consecutive/reset counts, elapsed
time and remaining phase/work time distinguish slow AX reads from layout
changes without reducing that requirement. Navigation requires an existing common
marker to move upward while window/surface geometry and marker X/width remain
stable. Scroll values remain diagnostic only until retained vertical-scrollbar
identity is available; reordering an array of control values cannot prove
navigation. Lazy AX marker population,
opposite movement, viewport movement/resizing and clipped-height changes alone
do not prove navigation. Typed native observations and pure self-tests enforce
this oracle, with finite node/text/scroll
observation counts. After that readiness wait it revalidates the unchanged
production focus guard for at most two seconds before the sole navigation;
this actual pre-effect check is the focus proof, while initial acquisition
status/diagnostics are retained. No content click or navigation is repeated during final focus revalidation.
If a proven owned dialog appears late, the same one-Escape total budget can
cancel it here, followed by one owned PDF content refocus and a fresh baseline
before any navigation, within a hard twenty-second phase bound. If the one
Escape was consumed during acquisition, the same refocus occurs here with the
Escape budget already spent. Fixture mouse events set clickState=1 and record a scoped public AX hit-test.
The exact inner PDF content's AXFocused setter is queried; when supported, the
owned fixture sets it and awaits actual focus at that exact element or a proven
noneditable descendant whose parent chain reaches the retained inner content
and then the exact window. Chromium focuses its PDF root (AXGroup) under the
inner AXWebArea, so element equality alone is not universal. Every ancestor
retains editable/modal rejection; extension-viewer/sidebar ancestors outside
inner content cannot authorize the sole navigation. Role/subrole ancestry and
the independent production focus-guard result are recorded.
https://github.com/chromium/chromium/blob/main/chrome/browser/pdf/pdf_extension_accessibility_test.cc
https://github.com/chromium/chromium/blob/main/ui/accessibility/platform/ax_platform_node_cocoa.mm Browser
versions and setter/readback results are recorded. No global-input fallback
is used. Actual
owned synthetic marker rectangles and scroll values, plus immediate pre-effect
focus and owned modal-window metadata, are recorded for effect diagnosis. The fixture records one navigation call and never retries
that call, including after a foreground refusal. The editable-control negative proof sends one process-targeted Cmd+L only
while the exact owned PDF process/birth/window is foreground, no modal is
focused and physical modifier/L keys are clear. It types no URL and sends no
Return. Up to four seconds of readback must prove an actual editable AX role
with settable value and native-owned ancestry reaching the exact window while
containing no web area, PDF root/viewer or dialog. Only the unchanged
production foreground refusal then passes the negative proof; no second
navigation is attempted. A shared 100-second browser-fixture work deadline bounds all
phases; the 120-second orchestration leaves time for owned process cleanup.
Deadline exhaustion fails required proofs rather than skipping them. It exercises actual
AX document recognition, bounded navigation with an observable scroll/text
position change, editable-control refusal and same-URL tab replacement. It closes only
its owned browser process and removes only its temporary profile. No user
browser profile, account or document is used. Only a missing browser or actually unavailable Accessibility permission is
`NOT VERIFIED`. For an installed browser with permission, all five proofs
(document identity, content focus, observed navigation, editable-focus refusal
and same-URL-tab refusal) are required. Any missing/incomplete proof is `FAILED`,
and the standalone fixture exits nonzero while retaining its JSON evidence. That failure records bounded stage
proofs and AX role/subrole/URL structure from only the owned fixture process.
URLs are reduced to scheme, host and extension; only the synthetic filename is
retained, never document paths, queries, fragments, text values, titles or user tabs.
For the exact trusted built-in extension origin only, its public resource path
is recorded to diagnose vendor entrypoint differences; document URLs remain
redacted.
After failed navigation or editable-focus proof, the fixture also captures
actual owned post-effect focus/modal state, including whether the focused AX
element is the exact clicked PDF content, original root or trusted viewer. Bounded heading/body text is read
only within a proven alert subtree in the owned fresh browser PID; general
window titles, document text and editable/password-field values are excluded.
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
