# Guest statistics and network reminder

The owner requested that the mini statistics already shown on castlink.ru also
reach the public repository and supported installer channels. Add a tiny chevron
immediately after every network grade, including No data, at the positions marked
on the supplied five-guest Console A screenshot. Clicking the grade/chevron opens
a compact reminder beside that card. Preserve the approved Console A composition.

The reminder describes the existing camera-track grade: Good when loss ≤2 packets,
jitter ≤30ms and RTT ≤150ms; Poor when loss >10, jitter >60ms or RTT >300ms;
otherwise Medium. The worst measurement determines the grade. Loss is cumulative
for the video track, not a recent loss percentage or internet bandwidth. Display
the current measured values or explain that no fresh measurement exists.

Use the existing native top-layer popover positioning and close/focus conventions,
with readable Russian/English/Chinese copy, an unobtrusive 10px chevron and a24px
click target. Escape, outside click and close dismiss it. Opening or updating the
reminder does not resize cards, navigate, close through polling or replace media.
Unknown, stale and muted cases remain honest; preserve the stable freshness owner
and the skip of identical guest-state updates.

Integrate onto current main, retaining its later fixes. Supported stable products
are Windows Client, Server Setup and Linux. Client renders its selected server's
web interface; server packages embed web. Refresh all requested packages, with
Client1.0.1 and web/server/source1.0.3, from one verified main source. Do not
promote experimental WSL drafts or introduce unsupported Mac artifacts. Publish
verified drafts, preserve previous assets, and update download links afterwards.
Existing server installations update only through their existing explicit action.
