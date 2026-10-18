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
