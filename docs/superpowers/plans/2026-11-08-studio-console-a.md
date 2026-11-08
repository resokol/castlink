# Studio Console A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship approved console A with live controls and guest pictures visible alongside program and existing statistics.
**Architecture:** Preserve media/control owners in StudioWorkspace. Extract focused view components only where they share product/fixture structure. Compact guest UI is opt-in; default cards and other workspace tabs keep their behavior.
**Tech Stack:** React/Next, TypeScript, CSS modules, native popovers, existing LiveKit/media code; no dependencies.
**Spec:** docs/superpowers/specs/2026-11-08-studio-console-a-design.md

## Global Constraints

- Approved A screenshots are the visual contract; stats/codecs and caster mobile are pinned.
- Actual footer/header count in1280×540/560/600; no701px escape into full-page flow.
- One device owner, stable video/capture refs; unchanged permissions/handlers/DSP.
- Root owns shared AudioMeter vertical API, unit proof, docs, validation and operations.
- mobile_ui owns Workspace, publishing controls, layout CSS and browser fixtures/tests. Root owns GuestVideoCard and its CSS.

## Review Focus

- Busy/connecting/moderator actions remain disabled or scoped exactly as before.
- Screen/remote-PC/auxiliary cards retain active Stop and input ownership surfaces.
- Source tabs/resize/disclosure do not recreate media or lose focused controls.
- Long names,20guests, real footer and low-height windows show complete guest video.
- New translated labels, native focus return/light-dismiss and default horizontal meters remain usable.

### Task1: Vertical meter and product layout shell
**Files:** AudioMeter.tsx/module.css, StudioReturnAudioMeter.tsx, StudioWorkspace.tsx, graphite-workspace.css; optional focused layout component.
**Interfaces:** AudioMeter/StudioReturnAudioMeter vertical?:boolean defaultsfalse, same analyser/mute inputs; layout consumes existing React slots/handlers.
- [x] Implement vertical display only; unit proves orientation does not restart analyser/RAF.
- [x] Replace rejected draft layout with approved A; use actual AppFooterSlot and shared view skeleton in fixture.
- [x] Verify16:10, low-to-high vertical geometry, real viewport budgets and unmodified stats design.

### Task2: Live publishing/disclosures and compact guest cards
**Files:** StudioReturnPublishingControls.tsx, GuestVideoCard.tsx, StudioWorkspace.tsx, CSS, locale strings when new.
**Interfaces:** Optional console/compact presentation props preserve existing default behavior; original callbacks and role/busy flags remain inputs.
- [x] Put actual publishing/mute/view/share actions into A's compact program controls.
- [x] Keep devices and invitations mounted in native labelled disclosures with focus/dismissal.
- [x] Expose quick microphone and advanced guest actions without losing statuses or source authority; keep preview/meter nodes stable.
- [x] Verify role/busy gates, default cards, screen sources, independent Stop and guest settings reachability.

### Task3: Relevant proof and review
**Files:** studio-compact.browser.cjs/fixture, publishing/device/meter/card tests; docs/manual map.
- [x] Reproduce failing low-height/compact assertions against rejected/875 structure first.
- [x] Chromium1440/1280/540/560/600,1/5/20guests, light/dark, empty and disclosure states; actual footer and hit bounds; resize/tab media identity.
- [x] Run TypeScript and focused unit suites, then full stable CI once final runtime source is frozen; update known fixture assumptions only for intended UI changes.
- [x] One batched visual inspection, one material-fix batch and confirmation; independent review against A and source invariant checks.

### Task4: Exact build and guarded installation
**Files:** working-state/deployment docs and external scoped build receipts.
- [ ] Commit verified exact source, bundle to owned Windows build host, build whole coherent image and exact281public overlay.
- [ ] Isolated smoke + compiled UI/artifact checks; fresh live-activity/config/neighbor guards.
- [ ] Install web only at strictzeroactivity, independent HTTPS version/assets check, preserve rollback and write receipts/currentstate.

## Verification evidence (local, 8 November2026)

- Final15-case Chromium proof: /workspace/studio-console-a-final/results.json;
 1280×540/560/600,1024×600/700,1440×900,1920×1080, light/dark,0/1/5/20sources.
- Three-column normal-height confirmation: /workspace/studio-console-a-tall-confirm
 (3cases); default Participants order RED→GREEN and16px mic confirmation:
 /workspace/studio-console-a-participants-{red,green} and
 /workspace/studio-console-a-mic-icon-green. No browser errors.
- Native menu resize1920→1280→1024 retains focus/bounds/media; actual footer and
 all4quality selectors fit including their clipping ancestors.
- Independent GPT-6.1 Sol high review found popupresize/default-details-order and
 old CSS override issues; all fixed and confirmed. Root also verified actual
 540px dark and1440px light captures against A references.
- Full CI first exposed a pre-existing camera-blur unit-harness dependency gap,
 reproduced against clean b8c2683: toolbar slots/window needed isolated mocks.
 Fixed test harness only. Screen-share tab AST fixture now supplies the new
 settingsOpen prop; original capture/mute assertions remain.
- Test media is local/synthetic; no live SFU/RemotePC session is claimed.

Final verification: TypeScript exit0,343 stable CI tests PASS (official run-ci.cjs,
/tmp/castlink-console-a-ci-verified.log), manualmap1854files current, diffcheck PASS.
