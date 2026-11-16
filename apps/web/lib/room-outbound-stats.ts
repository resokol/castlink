import type { Room, LocalTrackPublication } from "livekit-client";
export type RoomOutboundStats = { publication: LocalTrackPublication; track: object; report: RTCStatsReport; sid: string; at: number };
const observers = new WeakMap<Room, Set<(sample: RoomOutboundStats) => void>>();
/** Observes existing telemetry reads; never schedules or reads RTC statistics. */
export function subscribeRoomOutboundStats(room: Room, callback: (sample: RoomOutboundStats) => void) {
  const listeners = observers.get(room) ?? new Set(); listeners.add(callback); observers.set(room, listeners);
  return () => { listeners.delete(callback); if (!listeners.size) observers.delete(room); };
}
export function publishRoomOutboundStats(room: Room, sample: RoomOutboundStats) {
  observers.get(room)?.forEach(callback => { try { callback(sample); } catch { /* Diagnostics never interrupt media. */ } });
}
