import { Room, RoomEvent, Track } from "livekit-client";
import { createStudioSenderStatsState, sampleStudioSenderStats } from "./studio-sender-stats";

const TOPIC = "studiolink-guest-camera-outbound";
type Participant = { identity: string; metadata?: string };
export type GuestCameraOutbound = { bitrateKbps: number | null };
export type ReceivedGuestCameraOutbound = GuestCameraOutbound & { receivedAt: number };

function role(participant: Participant) {
  try { return JSON.parse(participant.metadata || "{}").role; } catch { return undefined; }
}

/** Camera traffic is operational data for staff; do not broadcast it to casters or outputs. */
export function guestCameraOutboundRecipients(participants: Iterable<Participant>) {
  return [...participants].filter(participant =>
    (participant.identity === "studio-panel-main" && role(participant) === "studio-panel") ||
    (participant.identity.startsWith("studio-moderator-") && role(participant) === "studio-moderator")
  ).map(participant => participant.identity);
}

export function parseGuestCameraOutbound(payload: Uint8Array, participant: Participant): GuestCameraOutbound | null {
  if (!participant.identity.startsWith("guest-") || role(participant) !== "guest" || payload.byteLength > 256) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(payload));
    if (value?.type !== "guest-camera-outbound" || !(value.bitrateKbps === null ||
      (typeof value.bitrateKbps === "number" && Number.isFinite(value.bitrateKbps) && value.bitrateKbps >= 0 && value.bitrateKbps <= 100_000))) return null;
    return { bitrateKbps: value.bitrateKbps };
  } catch { return null; }
}

export function freshGuestCameraOutboundBitrate(sample?: ReceivedGuestCameraOutbound, now = Date.now()): number | null {
  return sample && now >= sample.receivedAt && now - sample.receivedAt <= 10_000 ? sample.bitrateKbps : null;
}

/** Measure the caster's own camera sender, summing simulcast RTP layers once each. */
export function watchGuestCameraOutbound(room: Room) {
  let stopped = false, busy = false;
  let state = createStudioSenderStatsState();
  const collect = async () => {
    if (stopped || busy) return;
    if (room.state !== "connected") { state = createStudioSenderStatsState(); return; }
    const destinations = guestCameraOutboundRecipients(room.remoteParticipants.values());
    if (!destinations.length) { state = createStudioSenderStatsState(); return; }
    busy = true;
    const sid = room.localParticipant.sid;
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = publication?.track;
    const muted = !!publication?.isMuted;
    const collectionState = state;
    try {
      let bitrateKbps: number | null = null;
      if (track && !muted) {
        const measured = await sampleStudioSenderStats(collectionState, track, undefined);
        if (!measured) return; // Missing/cached stats must age out, never become a fresh zero.
        bitrateKbps = measured.metrics.videoKbps;
        if (state !== collectionState) return;
      } else state = createStudioSenderStatsState();
      if (stopped || room.state !== "connected" || room.localParticipant.sid !== sid ||
        room.localParticipant.getTrackPublication(Track.Source.Camera)?.track !== track ||
        !!room.localParticipant.getTrackPublication(Track.Source.Camera)?.isMuted !== muted) return;
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "guest-camera-outbound", bitrateKbps })), {
        reliable: false, topic: TOPIC, destinationIdentities: destinations,
      });
    } catch { /* Optional measurements must never interrupt media. */ }
    finally { busy = false; }
  };
  const update = () => { void collect(); };
  const reset = () => { state = createStudioSenderStatsState(); update(); };
  const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.Disconnected, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished];
  events.forEach(event => room.on(event, reset));
  const timer = setInterval(update, 2000);
  update();
  return () => { stopped = true; clearInterval(timer); events.forEach(event => room.off(event, reset)); };
}

export const GUEST_CAMERA_OUTBOUND_TOPIC = TOPIC;
