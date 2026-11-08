# Approved Studio console A

User choice: «Вариант А», after viewing actual Chromium concepts.
Approved visual reference: /workspace/studio-redesign-options/a/a-dark-1280x600-5-guests.png
and a-light-1440x900-5-guests.png; source/a/fixture.tsx and style.css.

Keep the existing graphite/mint world and the approved statistics/codecs panel.
Program monitor left16:10, vertical44px meter immediately right, ON AIR/program
sound always visible below, devices and room-view controls in a compact group.
Guests form a compact grid beside program; show names, video, audio meter, quick
microphone and labelled advanced settings. Stats/codecs occupy the right rail.
Devices, invitations/access and advanced guest functions use native disclosures.
All7 navigation destinations, actual AppChrome footer, permissions and actions
remain available. This is a product implementation, not the prototype's local mocks.

Desktop1280×540/560/600 must show program and actual guest pictures on the same
screen with the real footer, without whole-page scroll/clipping. Additional guests
scroll inside the guest grid; settings scroll within disclosures. Five/20guests,
long names, empty/connecting/muted states must stay usable. Normal1440×900 and
1920×1080 retain the same composition. Smaller desktop widths get a coherent
responsive adaptation; mobile caster remains approved and untouched.

Preserve every existing primary/moderator/connecting gate, busy/disabled state,
callback and pending/error status. Keep one device-controller owner and mounted
video/stream/capture/analyser references across tab/resize/settings changes.
Guest rename, camera/microphone, quality, monitoring, output links, role/transfer/
kick/refresh and remote/screen source authority must remain reachable. Native
popover focus/dismissal works; active Stop and remote input status cannot be hidden.
No API/DSP/encoder changes. Shared AudioMeter horizontal is the default; only
StudioReturnAudioMeter gets vertical=true. Existing statistics/codecs values come
from live props and are never replaced by prototype data. Russian/English/Chinese
accessible names and new short labels are translated.

Implementation scope is the web UI. Build from exact checked source and install
only after verification, preserving281public,8neighbors/config/profiles/data;
no migrations/cleanup. Currentproduction8750294. Source transfer review and real
activity gates apply at deployment; prepare everything before requesting any
missing external approval or quiet period.
