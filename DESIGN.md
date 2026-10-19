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

## Approved caster presentation controls — 19 October 2026

The owner approved the [Zoom-style floating slide controls](design-preview/new/co-presentation-toolbar.html) and explicitly included them in the caster workspace redesign. The web adapter and Windows v2 bridge implement this direction. The [delivery record](docs/testing/CASTER_PRESENTATION_TOOLBAR_RU.md) tracks the shipped version and verification; the [design record](docs/design/CO_PRESENTATION_TOOLBAR_20261019.md) retains the approved mockup.

Keep the room title above the workspace, strictly 16:9 caster cards in the main gallery, chat on the right and the main controls below. Put the presentation entry and the action to reopen its controls in the bottom control area. “Системные настройки” remains the separate bottom-right device/camera/audio settings action.

Slide controls belong to a separate movable floating window above the presentation, following the approved compact graphite toolbar: filename, previous/slide count/next, “Управление слайдами” participant menu, and hide. A green sharing-status strip and the owner's red “Остановить показ” sit beneath it. The expanded menu must leave Stop visible. Closing or hiding this window leaves the presentation running; the bottom control area allows reopening it.

Show the selected caster and allow the owner to reclaim control in the same menu. Preserve the existing single-controller model: owner navigation is disabled while another caster controls; the selected caster receives slide navigation, while delegation/reclaim/stop remain owner actions. Transfer only slide navigation. Keep camera, microphone and private talkback independent from presentation controls.

The main gallery and chat remain mounted while the presentation window is opened, hidden or moved. Respect the actual sharing and rendered-slide state; connecting PowerPoint controls alone does not establish that its image is being shared. Implement the same visual direction for supported PDF/PPTX and connected native PowerPoint sessions, with existing import/media limitations retained. Never substitute a normal application-window screen share for a registered collaborative presentation session.
