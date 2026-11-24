# Primary studio diagnostics

[Русский](../../STUDIO_DIAGNOSTICS.md) · [简体中文](../zh-CN/STUDIO_DIAGNOSTICS.md)

## When audio cuts out or video freezes

Open **Statistics** in the main studio and select the room and a period covering the incident. Start with all roles, participants and sessions. Note the time and time zone, whose stream was affected and who noticed it. Participants do not need to take any action.

Enter the local time in **Incident minute** and select **Review minute**. Compare the same track at the publisher and each receiver, its peak loss and the five-second intervals with measurements. Client availability shows connection states and reconnects between observations of each session. **Download this minute’s diagnostics** saves the measurements and findings for the displayed minute.

Platform administrators also see LiveKit API probes and the numbers of keyframes received and forwarded across all rooms on the node during each measured interval. One incoming frame can reach multiple receivers. The background sampler runs approximately every 15 seconds and retains up to 24 hours of node history. Restarts, gaps and missing counters can leave a value unavailable. For stock LiveKit 1.13.11 on a private Docker Compose bridge, add `infrastructure/production/compose.incident-metrics.bridge.yml` to the existing project’s Compose files. The overlay requires bridge networking and publishes no ports.

1. Select **Analyze connection issues**. Find the episode by time and source, then review its measurements and suggested action. An observed condition can come directly from the sender’s browser, for example when it reports CPU-limited encoding. A likely cause comes from comparing the same stream across receivers. With insufficient evidence, the affected side remains unknown. Filtering to one receiver can remove the other points of comparison.
2. If the same stream froze for several receivers at once, check the sender and their shared delivery path. Overlapping symptoms alone cannot establish a server fault. When available, LiveKit history confirms that a track was published and records its mute state at the time of the observation. Packet loss requires media connection reports. The measurements may leave the specific router or network provider unknown.
3. Select **Download full diagnostics** with the same filters. The browser saves an NDJSON file. Its first line, `manifest`, gives the selected time bounds. Client samples and any available LiveKit observations follow. The last line, `summary`, contains the findings and the `complete` flag. A missing final line or `complete: false` indicates a partial export. Even with `complete: true`, there can be periods when no measurements arrived. Send the file to the investigator with the time and description of the incident.

Platform administrators also receive `server-load-sample` rows with the original node CPU measurements. If elevated CPU coincides with an incident, check which processes were busy then. Timing alone does not identify LiveKit as the cause.

Analysis and export read stored history on demand. The file is streamed in chunks. During a broadcast, selecting a short interval around a known incident reduces processing time.

Audio meters now update inside their own components instead of updating the participant roster every animation frame.

After updating the server, reopen the primary studio in your browser or Windows Client. Open **Statistics → Primary studio diagnostics**. The latest received data refreshes with Statistics approximately every15seconds; samples are sent approximately every2seconds. Stale data is marked.

Measurements include tab visibility, main-thread timer delay and session maximum, JavaScript error/rejection counters, and JavaScript heap and long tasks when supported. Unsupported measurements are unknown, not zero. Background timer throttling is not counted as a visible-interface stall. JavaScript heap is not total tab or GPU memory.

**Studio diagnostics → JSON** exports the selected period/day/participant/session; select the Studio role for primary-studio evidence. Downloads are capped at50000samples or20MiB and marked partial when truncated. Existing studio-owner/room-admin permissions apply; platform history requires super-admin.

**This tab's log → JSON** works independently of server statistics. A bounded current/previous-session snapshot is saved in sessionStorage roughly every10seconds and on visibility/teardown events. Reload preserves the preceding session in the same tab/origin when storage is allowed. Closing the tab can remove it. With storage blocked, available current data remains in memory.

Server samples use existing hourly JSONL files under `${STUDIOLINK_STATS_DIR}` or `${STUDIOLINK_DATA_DIR}/stats/<room-hash>/<hour>.jsonl`; older hours become `.jsonl.gz`. Default retention is30days with a shared512MiB disk cap, which can shorten the available period. Existing sanitized browser errors appear as `browser.crash` in web-service logs (`docker logs` or the installation's normal log). Check full server logs before sharing them.

New runtime fields contain no media recordings, passwords, tokens, full URLs, device names or arbitrary error messages. Existing server statistics exports include participant names/identities; share only with incident investigators.

A complete renderer/GPU crash or process exit may prevent a final sample. Gaps and preceding measurements narrow the investigation but do not prove a cause. After an incident, export server JSON for that time and the original tab's local log, and record the time and screen appearance.

Timeweb and standalone servers update separately. Other installations need updated Windows/Linux server packages; updating a Client EXE does not update its server. A client opening an updated server receives the new studio web code after reloading.

## Audio diagnostics

Builds with extended audio diagnostics export publication, SDK-track, native MediaStreamTrack and playback-element mute separately. `Muted элемента воспроизведения` replaces the old `Muted` CSV heading; it does not indicate whether the caster muted their microphone. Existing column positions are preserved; new columns are appended.

Outgoing audio records available actual capture sample rate, channel count, NS/AEC/AGC/voice isolation and the linked media-source level. Device names and IDs are not collected. Incoming audio adds cumulative and interval silentConcealedSamples, inserted samples and removed samples for decoder rate correction. These distinguish silent substitution from speech concealment and rate adjustment; they do not by themselves identify the cause of audible distortion.

100% Concealed does not mean 100% network loss: a receiver can keep producing concealed silence while a publication is muted. Compare sender mute, RTP arrival, source level and other receivers. Unsupported values and older records remain blank. Missing track RTP statistics can also mean missing diagnostic fields. New fields require a server update and off-air reload of sender/receiver pages; old history is not backfilled. No automatic microphone restart or unmute is added.

A `partial` file contains only part of the selected period, starting with earlier records; a later incident may be absent. Check the final timestamp and select a shorter live period or one participant/session. For an arbitrary historical interval, an operator can read retained hourly files or the existing authorized API with fixed `to`, `minutes` and sequential `cursor` values.
