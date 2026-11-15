import { Room, RoomEvent, Track } from "livekit-client";
import { subscribeRoomOutboundStats } from "./room-outbound-stats";
import { createGuestUplinkStatsState, sampleGuestUplinkStats, guestNetworkGrade, GUEST_UPLINK_FRESH_MS } from "./guest-uplink-stats";
import type { GuestNetworkMetrics, PacketLoss } from "./guest-network-stats";
import { createStudioSenderStatsState, sampleStudioSenderStats } from "./studio-sender-stats";

const TOPIC = "studiolink-guest-camera-outbound";
// Persist across watcher remounts; a new LiveKit SID starts an independent sequence.
const outboundSequences = new WeakMap<Room, { sid: string; sequence: number }>();
type Participant = { identity: string; metadata?: string; sid?: string };
export type GuestUplinkSample = Omit<GuestNetworkMetrics, "stability"> & { active: boolean; ageMs: number | null };
export type GuestUplinkView = GuestNetworkMetrics & { active: boolean; expiresAt: number };
export type GuestCameraOutbound = { bitrateKbps: number | null; uplinkSequence?: number; uplink?: { video: GuestUplinkSample; audio: GuestUplinkSample } };
export type GuestUplink = { video: GuestUplinkView; audio: GuestUplinkView };
export type ReceivedGuestCameraOutbound = GuestCameraOutbound & { receivedAt: number; uplinkReceivedAt?: number };

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
  if (!participant.identity.startsWith("guest-") || role(participant) !== "guest" || payload.byteLength > 2048) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(payload));
    if (value?.type !== "guest-camera-outbound" || !(value.bitrateKbps === null ||
      (typeof value.bitrateKbps === "number" && Number.isFinite(value.bitrateKbps) && value.bitrateKbps >= 0 && value.bitrateKbps <= 100_000))) return null;
    if (value.uplink === undefined) return { bitrateKbps: value.bitrateKbps };
    if (!Number.isSafeInteger(value.sequence) || value.sequence <= 0 || value.version !== 1 || typeof value.sid !== "string" || value.sid !== participant.sid) return null;
    const metric = (n: unknown) => n === null || typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100000;
    const validLoss = (n: any): n is PacketLoss | null => n === null || n && Number.isSafeInteger(n.packets) && n.packets >= 0 &&
      typeof n.percent === "number" && Number.isFinite(n.percent) && n.percent >= 0 && n.percent <= 100;
    const read = (leg: any): GuestUplinkSample | null => {
      if (!leg || typeof leg.active !== "boolean" || !validLoss(leg.currentLoss) || !validLoss(leg.totalLoss) ||
          !metric(leg.jitterMs) || !metric(leg.rttMs) || !(leg.ageMs === null || typeof leg.ageMs === "number" && Number.isFinite(leg.ageMs) && leg.ageMs >= 0 && leg.ageMs <= GUEST_UPLINK_FRESH_MS)) return null;
      if (leg.currentLoss !== null && (leg.ageMs === null || !leg.active)) return null;
      return { active: leg.active, currentLoss: leg.currentLoss, totalLoss: leg.totalLoss, jitterMs: leg.jitterMs, rttMs: leg.rttMs, ageMs: leg.ageMs };
    };
    const video = read(value.uplink?.video), audio = read(value.uplink?.audio);
    return video && audio ? { bitrateKbps: value.bitrateKbps, uplinkSequence: value.sequence, uplink: { video, audio } } : null;
  } catch { return null; }
}

export function freshGuestCameraOutboundBitrate(sample?: ReceivedGuestCameraOutbound, now = Date.now()): number | null {
  return sample && now >= sample.receivedAt && now - sample.receivedAt <= 10_000 ? sample.bitrateKbps : null;
}

const receivedViews = new WeakMap<ReceivedGuestCameraOutbound, { value: GuestUplink; expired: string }>();
/** Convert the sender's feedback-age budget to the receiving studio's local clock. */
export function freshGuestUplink(sample?: ReceivedGuestCameraOutbound, now = Date.now()): GuestUplink | undefined {
  if (!sample?.uplink) return;
  const make = (leg: GuestUplinkSample): GuestUplinkView => {
    const expiresAt = leg.ageMs === null ? 0 : (sample.uplinkReceivedAt ?? sample.receivedAt) + GUEST_UPLINK_FRESH_MS - leg.ageMs;
    const fresh = leg.active && now >= sample.receivedAt && now <= expiresAt;
    const currentLoss = fresh ? leg.currentLoss : null, jitterMs = fresh ? leg.jitterMs : null, rttMs = fresh ? leg.rttMs : null;
    return { active: leg.active, expiresAt, currentLoss, totalLoss: leg.totalLoss, jitterMs, rttMs, stability: guestNetworkGrade(currentLoss, jitterMs, rttMs) };
  };
  const expired = Object.values(sample.uplink).map(leg => leg.ageMs !== null && now > (sample.uplinkReceivedAt ?? sample.receivedAt) + GUEST_UPLINK_FRESH_MS - leg.ageMs).join(":");
  const cached = receivedViews.get(sample);
  if (cached && cached.expired === expired) return cached.value;
  const value = { video: make(sample.uplink.video), audio: make(sample.uplink.audio) };
  receivedViews.set(sample, { value, expired }); return value;
}

/** Measure the caster's own camera sender, summing simulcast RTP layers once each. */
export function watchGuestCameraOutbound(room: Room) {
  let stopped = false, busy = false;
  let state = createStudioSenderStatsState();
  let uplinkSid = room.localParticipant.sid;
  let upstream = { video: createGuestUplinkStatsState(), audio: createGuestUplinkStatsState() };
  const stopObserving = subscribeRoomOutboundStats(room, sample => {
    if (stopped || room.state !== "connected" || sample.sid !== room.localParticipant.sid) return;
    if (sample.sid !== uplinkSid) { upstream = { video: createGuestUplinkStatsState(), audio: createGuestUplinkStatsState() }; uplinkSid = sample.sid; }
    const kind = sample.publication.source === Track.Source.Camera ? "video" : sample.publication.source === Track.Source.Microphone ? "audio" : undefined;
    if (!kind || sample.publication.isMuted || room.localParticipant.getTrackPublication(sample.publication.source) !== sample.publication || sample.publication.track !== sample.track) return;
    sampleGuestUplinkStats(upstream[kind], sample.track, sample.report, sample.at, kind);
  });
  const uplink = () => {
    const now = Date.now();
    const read = (kind: "video" | "audio"): GuestUplinkSample => {
      const publication = room.localParticipant.getTrackPublication(kind === "video" ? Track.Source.Camera : Track.Source.Microphone);
      const active = !!publication?.track && !publication.isMuted;
      const metrics = sampleGuestUplinkStats(upstream[kind], active ? publication?.track : undefined, undefined, now, kind);
      const ageMs = upstream[kind].freshAt === undefined || now - upstream[kind].freshAt! > GUEST_UPLINK_FRESH_MS ? null : Math.max(0, now - upstream[kind].freshAt!);
      return { active, currentLoss: metrics.currentLoss, totalLoss: metrics.totalLoss, jitterMs: metrics.jitterMs, rttMs: metrics.rttMs, ageMs };
    };
    return { video: read("video"), audio: read("audio") };
  };
  const collect = async () => {
    if (stopped || busy) return;
    if (room.state !== "connected") { state = createStudioSenderStatsState(); return; }
    const destinations = guestCameraOutboundRecipients(room.remoteParticipants.values());
    if (!destinations.length) { state = createStudioSenderStatsState(); return; }
    busy = true;
    const sid = room.localParticipant.sid;
    if (uplinkSid !== sid) { upstream = { video: createGuestUplinkStatsState(), audio: createGuestUplinkStatsState() }; uplinkSid = sid; }
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = publication?.track;
    const muted = !!publication?.isMuted;
    const collectionState = state;
    try {
      let bitrateKbps: number | null = null;
      if (track && !muted) {
        const measured = await sampleStudioSenderStats(collectionState, track, undefined);
        if (!measured && !upstream.video.freshAt && !upstream.audio.freshAt) return; // Legacy clients retain their bitrate cadence.
        bitrateKbps = measured?.metrics.videoKbps ?? null;
        if (state !== collectionState) return;
      } else state = createStudioSenderStatsState();
      if (stopped || room.state !== "connected" || room.localParticipant.sid !== sid ||
        room.localParticipant.getTrackPublication(Track.Source.Camera)?.track !== track ||
        !!room.localParticipant.getTrackPublication(Track.Source.Camera)?.isMuted !== muted) return;
      const options = { reliable: false, topic: TOPIC, destinationIdentities: destinations };
      // Old studios reject large payloads; preserve the original compact bitrate message.
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "guest-camera-outbound", bitrateKbps })), options);
      if (stopped || room.state !== "connected" || room.localParticipant.sid !== sid || (track && !muted && state !== collectionState) ||
        room.localParticipant.getTrackPublication(Track.Source.Camera)?.track !== track ||
        !!room.localParticipant.getTrackPublication(Track.Source.Camera)?.isMuted !== muted) return;
      const previousSequence = outboundSequences.get(room);
      const sequence = previousSequence?.sid === sid ? previousSequence.sequence + 1 : 1;
      outboundSequences.set(room, { sid, sequence });
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: "guest-camera-outbound", version: 1, sid, sequence, bitrateKbps, uplink: uplink() })), options);
    } catch { /* Optional measurements must never interrupt media. */ }
    finally { busy = false; }
  };
  const update = () => { void collect(); };
  const reset = () => {
    state = createStudioSenderStatsState();
    if (uplinkSid !== room.localParticipant.sid) { upstream = { video: createGuestUplinkStatsState(), audio: createGuestUplinkStatsState() }; uplinkSid = room.localParticipant.sid; }
    for (const kind of ["video", "audio"] as const) sampleGuestUplinkStats(upstream[kind], undefined, undefined, Date.now(), kind);
    update();
  };
  const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.Disconnected, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished];
  events.forEach(event => room.on(event, reset));
  const timer = setInterval(update, 2000);
  update();
  return () => { stopped = true; stopObserving(); clearInterval(timer); events.forEach(event => room.off(event, reset)); };
}

export const GUEST_CAMERA_OUTBOUND_TOPIC = TOPIC;
