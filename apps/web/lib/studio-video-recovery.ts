import { ConnectionState, Room, Track, type RemoteTrackPublication } from "livekit-client";

// A dead decoder can leave audio playing indefinitely. Only recover an enabled,
// unmuted studio video after three consecutive samples without decoded frames.
export function watchStudioVideo(room: Room, videoEnabled: (identity: string) => boolean = () => true) {
  const samples = new Map<string, { frames: number; stalled: number }>();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const recovering = new Map<RemoteTrackPublication, ReturnType<typeof setTimeout>>();
  const poll = async () => {
    try {
      const present = new Set<string>();
      if (room.state === ConnectionState.Connected) {
        for (const participant of room.remoteParticipants.values()) {
          if (!participant.identity.startsWith("studio-panel-") || !videoEnabled(participant.identity)) continue;
          for (const pub of participant.videoTrackPublications.values()) {
            if (pub.kind !== Track.Kind.Video || !pub.isDesired || pub.isMuted || !pub.track) continue;
            present.add(pub.trackSid);
            const report = await pub.track.getRTCStatsReport();
            if (stopped) return;
            let frames: number | undefined;
            report?.forEach(s => { if (s.type === "inbound-rtp" && (s.kind === "video" || s.mediaType === "video")) frames = s.framesDecoded; });
            if (frames === undefined) continue;
            const previous = samples.get(pub.trackSid);
            const stalled = previous?.frames === frames ? previous.stalled + 1 : 0;
            samples.set(pub.trackSid, { frames, stalled });
            if (stalled >= 3 && pub.isDesired && !pub.isMuted) {
              samples.delete(pub.trackSid);
              pub.setSubscribed(false);
              recovering.set(pub, setTimeout(() => {
                recovering.delete(pub);
                if (!stopped && videoEnabled(participant.identity) && room.state === ConnectionState.Connected && participant.videoTrackPublications.get(pub.trackSid) === pub) pub.setSubscribed(true);
              }, 250));
            }
          }
        }
      }
      for (const sid of samples.keys()) if (!present.has(sid)) samples.delete(sid);
    } catch { /* A transient stats failure must not break monitoring. */ }
    if (!stopped) timer = setTimeout(poll, 5000);
  };
  timer = setTimeout(poll, 5000);
  return () => { stopped = true; clearTimeout(timer); recovering.forEach(clearTimeout); recovering.clear(); };
}
