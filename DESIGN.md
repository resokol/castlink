---
name: CastLink — approved design preview
description: Neutral graphite surfaces, mint accents and Manrope for the existing broadcast workspace.
colors:
  primary: "#acd9bb"
  primary-hover: "#bce6c9"
  page-bg: "#111315"
  panel-bg: "#191c20"
  secondary-bg: "#25292e"
  secondary-hover: "#30363d"
  field-bg: "#22262c"
  field-border: "#444b54"
  panel-border: "#343a42"
  text: "#eef0f2"
  muted: "#adb4bd"
  light-primary: "#245d43"
  light-primary-hover: "#194831"
  light-page-bg: "#f2f3f5"
  light-panel-bg: "#fff"
  light-secondary-bg: "#e8ebee"
  light-secondary-hover: "#dce1e6"
  light-field-bg: "#fff"
  light-field-border: "#929da9"
  light-panel-border: "#c9d0d8"
  light-text: "#20252c"
  light-muted: "#53606d"
  light-media-accent: "#286746"
typography:
  headline:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  control: "8px"
  media: "10px"
  panel: "12px"
spacing:
  compact: "8px"
  standard: "16px"
  section: "20px"
  spacious: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.page-bg}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  panel:
    backgroundColor: "{colors.panel-bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
---

# Design System: CastLink preview

## Owner-approved primary standard — 20 October 2026

The owner approved the entry renders as the best design for CastLink and explicitly requested this style for future UI: minimalism, informative action labels and clear placement. [Approved entry standard](docs/design/ENTRY_DESIGN_20261020_RU.md) and `design-preview/entry-approved/` are the visual authority for these entry screens. Use graphite/mint and the matching light palette, thin borders, 8px controls and 12px panels. Show the user's primary decision first; disclose technical/server operations separately. Do not redesign unrelated existing screens as a side effect.

The new entry screens are the default, not an optional preview. Existing role authorization, media defaults, device lifecycle, transfer and recovery remain authoritative. The preflight illustration with its camera off is a state example, not a new disabled-camera default.

## Overview

The approved preview uses neutral graphite surfaces, restrained mint accents and Manrope. It supports real broadcast work: media previews lead, controls stay compact, and operational states remain readable. This document records the implemented preview, not a replacement of the default design.

Visual sources: [base tokens](design-preview/new/base-theme.css), [studio and multiview](design-preview/new/studio-theme.css), [guest and staff](design-preview/new/guest-theme.css), [entry and operations](design-preview/new/operations-theme.css). The approved static gallery is in `design-preview/new/`; its sample data and inert controls are illustrative.

## Colors

Use the frontmatter's dark palette by default. Mint identifies primary actions, focus and selection; backgrounds, fields and borders remain neutral graphite. Light mode uses the matching `light-*` tokens and the existing CSS variables. Preserve semantic broadcast, role and error colors; ON AIR remains red.

## Typography

Use the bundled Manrope family with Arial/sans-serif fallback and tabular numerals. Workspace headings use the headline role; entry headings scale from 25–31px. Controls and supporting text use the implemented 11–13px sizes. Preserve RU/EN/ZH content and allow labels to wrap.

## Layout

Desktop workspaces use a 208px sidebar and flexible main column; the studio inspector is 330px. Surface styles collapse columns at their existing 1100px, 760px and 700px breakpoints. Keep media geometry, vertical scrolling and locally scrollable data tables intact. Reuse the observed spacing rhythm rather than forcing one layout onto every route.

## Elevation & Depth

Panels are flat: tonal surfaces and thin borders establish hierarchy. Existing media and dialogs keep their functional layering; do not add decorative shadows.

## Shapes

Use the existing 6–8px control corners, 10px media corners and 12px panel corners. Scene and source geometry belongs to the multiview controller, including intentional cropping and transparency.

## Components

Primary actions use mint with dark text in dark mode and deep green with light text in light mode. Secondary actions use neutral surfaces. Fields have visible borders; keyboard focus uses the accent outline. Preserve actual selected, disabled, busy, loading, error and recovery states. Navigation reflects the current role and active workspace section.

## Do's and Don'ts

- Do scope native preview styles to `html[data-design-preview=on]`; entry uses `?design=preview`, `?design=current` and a removable session preference.
- Do preserve existing controls, authorization, actual measurements and mounted media when toggling or navigating.
- Don't add sample participants, telemetry, success states or inert controls to match a mock.
- Apply the shared theme to every route, including `/watch`, `/monitor` and `/transfer`. Do not inject testing banners into these routes or `/output` and `/multiview`. Clean media outputs stay transparent, without added chrome or changes to frame geometry.

## Visual acceptance

Theme presence, a successful build and passing browser assertions are not visual acceptance. Inspect rendered page families, including guest, primary studio, administrator and moderator; cover desktop/mobile and supported light/dark themes. Record the images actually viewed, their freshness and unverified states. Never report all pages visually complete from CSS coverage alone.

Align adjacent content surface top edges. Put headings in a shared grid row or inside their card; do not compensate with guessed offsets. Prevent taller sidebars from stretching empty primary panels, and keep exit actions out of media overlays. Preserve intentional aspect-ratio letterboxing and local table scrolling.

Review record: [18 October alignment audit](docs/design/VISUAL_ALIGNMENT_20261018.md).

## Participant and source workspaces

The guest controls are centered below an equal-size 16:9 gallery; Exit belongs in the room header immediately before the identity badge. Gallery frames preserve source proportions with containment. Studio-only viewing keeps its dedicated monitor layout. Guest screen sharing retains the mint accent; the studio transport action is neutral.

The Participants tab uses a source roster on the left and the selected camera or screen on the right. Desktop Studio overview uses compact source cards. Selection and navigation must preserve mounted media and control state. Camera and screen are distinct sources, not two videos squeezed into one camera card. Frequent mute/video actions stay by the preview; device, quality, image and diagnostic controls remain available in expandable groups. Existing CastLink permissions and media behavior govern every action.

Guest source meters use the full card width and the same labelled dBFS scale as Studio Return. The primary studio camera appears only in Studio Return; its separate screen share remains a source. Raw publication diagnostics do not belong beneath the studio preview.

## Caster presentation controls — owner correction, 19 October 2026

The owner's latest Zoom reference replaces the earlier large floating toolbar as the default entry. Keep an always-visible blue “Управление” button immediately after the mint Screen Share button in the same bottom transport row. Opening it reveals a compact graphite popover above the button; it must not resize the gallery or chat. System settings remain at the bottom right.

The active-session menu shows the filename, current controller, previous/count/next, the available casters as direct selection actions, reclaim and the owner's independent Stop while sharing. File import, Office connection and optional floating controls belong to progressive disclosure during an active session. When no session is connected, the file/Office entries explain how to enable collaboration. Do not automatically open the earlier large floating window.

Retain the existing single-controller model and server authorization. Delegation transfers slide navigation only; owner-only delegation, reclaim and Stop preserve existing session ID/generation/SID guards. Stop remains available independently of pending navigation or a temporary control API error. Closing the popover preserves the PDF canvas, capture, gallery, chat, devices and private talkback. A connected PowerPoint grant alone must not claim active sharing. Keep a bounded, keyboard-accessible popover, clear unavailable states, all supported locales and both themes.

The earlier [design record](docs/design/CO_PRESENTATION_TOOLBAR_20261019.md) and [delivery](docs/testing/CASTER_PRESENTATION_TOOLBAR_RU.md) remain historical evidence. The current [compact-menu delivery record](docs/testing/CASTER_CONTROL_MENU_RU.md) records this correction and its verification.

## Recipient slide popup — 19 October 2026

A delegated caster receives a compact floating card inside CastLink as soon as a current grant matches both identity and session SID. Keep it around 300px wide: filename, previous/rendered slide count/next and a hide action, with the same graphite/blue vocabulary and supported light theme. Do not show owner delegation, reclaim or Stop actions. Revoke, disconnect or loss of that session closes the card and prevents stale actions. Polling must preserve focus, position and a user's same-grant dismissal; the blue Controls entry reopens it, and a new grant can reveal it again. Preserve the owner's existing compact menu, gallery, chat and media. No automatic external/native large window is introduced.


## Native presentation panels — owner correction, 20 October 2026

For the Windows client, the owner and delegated recipient need a compact independent always-on-top window while PowerPoint fills their single display. Reuse the protected native slides controller and its draggable header. Owner controls retain navigation, independent Stop, delegation and reclaim; recipient controls expose navigation only. Open a current native grant once; polling never cancels local dismissal. The primary Remote control entry reopens the native window, with a separate file action retaining import and session selection. Browsers and native failure retain the in-app controls. Closing either view never stops media. Keep exact grant/SID/scope cleanup and both system themes. Native layout changes require a new Windows client build; do not describe a web-only update as upgrading bundled UI.

## Compact caster slots — approved 20 October 2026

The Participants slot panel uses aligned rows with name/status, fixed assignment actions, camera/screen/invitation copy controls and an accessible settings gear. Empty slots retain a disabled Release control to preserve column alignment. Creation opens inline from the header. Counts come from actual assignments and the connected roster; reconnecting sources remain assigned. Full URLs, slot ID, rename/invitation binding, rotation and deletion remain inside the native disclosure. Standalone invitations stay accessible below the list.

Use existing graphite/light tokens and compact 10–13px supporting type. The approved preview uses 6px controls, a small neutral count badge and an amber reconnect/incomplete-operation state; these intentional surface details refine the broader token catalog. Layout follows the panel's available width via container queries. Long retry labels may wrap; ordinary actions retain aligned columns. Existing server authorization and routing govern all actions.


## PR73 responsive conference scene — approved 21 October 2026

Owner correction after PR73, 21 October: the local mode is labelled Windows / Окна / 窗口. Mobile has no resize separator in either orientation. Browser/desktop resizing is available only with a shared screen or co-presentation source. The main source stays fixed while the readable guest rail can scroll; media stays mounted and contained proportionally. Mobile transport reserves 20px plus the safe area below its controls. The web presentation menu follows the compact native header, navigation/control row and sharing/independent Stop strip. See [verification](docs/testing/CONFERENCE_CONTROLS_20261021_RU.md).

The owner approved the graphite/mint design and automatic adaptation to16:9,16:10,4:3 and arbitrary window shapes. Preserve decoded source/page aspect with contain; window aspect controls layout, not pixel stretching. Speaker/Tiles is a local saved choice for caster/staff. Shared screen wins over microphone activity; automatic speaker selection defaults on with a1000ms stable candidate and can be disabled in View settings.

Portrait mobile uses a large main source and horizontally scrollable participant strip below; landscape uses a right strip. A pointer/keyboard separator changes the allocation without remounting media. Compact mobile transport exposes microphone/camera/chat and secondary sharing actions through More; desktop sharing actions remain directly exposed. Hidden self preview stays mounted, and studio-only self preview is secondary PiP excluded from auto focus.

Current co-presentation owner and one delegate may both navigate through the existing rendered revision/ACK pipeline; stale competing commands get409 without auto replay. Only owner delegates/reclaims/stops. Web/native small controls retain independent Stop and close-without-stopping behavior. The entry name field is prominent and describes name visibility.

## PR73 regression correction — 21 October 2026

Desktop caster transport actions form one horizontal row inside the disclosure content; avoid display:contents on details and its content. Speaker filmstrip cells retain16:9 regardless of participant count, with scrolling for extra participants. Natural-height staff source cards include controls/meters/settings and belong directly in source-deck, outside media-only ConferenceScene sizing. Keep their authorized sources, command nodes and callbacks mounted.

## Owner-selected PR75/PR77 integration — 21 October 2026

Preserve the large, constant-ratio desktop participant filmstrip from PR75 (comparison1/2left), and the compact mobile layout from PR77 (comparison4topright). Use the working PR77 More menu. Screen sharing retains mint #acd9bb and co-presentation retains blue #b8d4f4; verify computed colors on the actual components in both themes. Keep source proportions, keyed media and existing authorization/lifecycle unchanged.

## Studio feedback — owner corrections, 21 October 2026

Retain the graphite workspace, mint screen action and blue co-presentation action. The owner specifically requests a warm orange surface for the display-name group and the studio Take control button. Preserve field contrast, existing corners and keyboard focus.

Studio device settings use a labelled Settings button in the action rail and a mounted hidden panel. The owner-approved overview uses the exact visible title STUDIO PLABACK, with playback, its audio meter and invitations on the left, and transport/outbound statistics on the right. A compact 18 px page heading returns space to playback and telemetry. Four equal output selectors form aligned rows below the chart and remain visible within the first desktop viewport; diagnostic history yields space and can scroll on short screens. Guest sources follow the full overview below the first desktop screen. On narrow screens the rail follows invitations and guests follow the rail. Tab and disclosure changes must not replace media nodes.

The empty co-presentation disclosure has one native marker, with no extra trailing chevron. The active delegation control keeps its established single chevron. Reclaim is labelled “Забрать управление” in browser/native panels. Direct Connect PowerPoint is removed; PDF/PPTX import remains. Existing native controls and independent Stop retain their lifecycle and authorization.

## Six-photo correction — 21 October 2026

Russian scene modes are «Окно» and «Плитка». Desktop keeps a visible vertical scrollbar and suppresses horizontal scrolling; preserve the pinned, proportionally contained main source and approved mobile layout. Image transform numeric fields retain 25px rows under the global theme. Remove only the duplicate Rotate90 from the primary guest card, keeping its continuous rotation control.

## Window resize separator — owner clarification, 21 October 2026

The vertical handle between the main source and the right participant rail resizes their allocation in desktop Window mode with camera-only and shared content alike. This supersedes the earlier shared-content-only restriction and the PR80 forced-scrollbar interpretation. Keep mobile resizing disabled, normal overflow scrolling, source containment and mounted media.

## Eight-point caster correction — owner approved 21 October 2026

Preserve the existing graphite/mint world. Portrait mobile Tiles uses two equal16:9 columns (one full-width source when alone), with vertical overflow for a long roster. Keep Window mode, desktop sizing, keyed media and mobile no-resize behavior. The studio inspector is compact enough for five overview source cards at1280px and above; retain every source action and diagnostic. Paired studio buttons and quality selects share dimensions despite wrapped labels. The warm orange display-name group becomes a softer pastel.

The approved chat set contains24 original classic-style vector smileys; store plain Unicode and retain existing ChatEntry/transport/history. Mobile inline icons are16px, picker icons20px with44px targets. Reactions has seven options and sits after Chat, before sharing; its independent transient room events appear at the scene center for2seconds, with bounded nearby echoes and reduced-motion fade. Never append them to chat or clean media outputs.

After the caster clicks Share presentation, open the current compact controls immediately: native Windows bridge first, desktop Document PiP from that click when available, inline on denial/unsupported browsers. This supersedes manual-only browser opening after import. Closing/dismissing controls never stops media and polling preserves the dismissal. See [implementation and evidence](docs/testing/CASTER_REACTIONS_20261021_RU.md).

### Latest owner correction — presentation flow, 22 October 2026

This supersedes the earlier always-visible co-presentation disclosure. Hide Co by default; show the existing compact control panel only for a live shared source. The screen-share PPTX/PDF choices retain the existing owner/delegate workflow. Upload PPTX/PDF only prepares a file: PPTX uses the existing converter to PDF, PDF stays direct, and neither action starts the helper or publication. A prepared-file popover has only Show and Delete. Show must publish the actual source before creating its co-presentation session. Stop ends the show and hides Co while retaining the prepared file. Preserve incumbent controls, colours, authorization and independent Stop; this is a flow correction, not a redesign.

### Unified floating presentation controls — owner approved, 23 October 2026 Moscow

Use one compact graphite/mint web toolbar: filename and controller once, then arrows/page, Controls disclosure and a single red Stop. Keep the separate Stop surface as a retained fallback only when the exact owned visible toolbar cannot provide Stop; hiding controls never ends media. Place the participant menu below the complete toolbar and constrain it to the viewport. Prepared-file controls may select a caster before Show; this is a local intent until the real source is published, followed by the existing delegation/acceptance flow. Preserve Show/Delete, owner keyboard/mouse navigation and the default auto-accept preference. The owner approved the real component renders and the web rollout is recorded in docs/testing/UNIFIED_PRESENTATION_PANEL_20261023_RU.md. The installed native UI is unchanged; its existing window remains always-on-top, while browser floating uses an explicit DocumentPiP action with inline fallback.
