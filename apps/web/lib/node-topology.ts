import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { readNodeRoomInventory } from "./room-store";
import { mediaRoomName } from "./studio-scope";
import { readHistory } from "./telemetry-store";
import { readStudioState } from "./studio-control";
import { mean, sumRates } from "./telemetry-types";

function roleFor(identity: string, raw?: string) {
  let m: Record<string, unknown> = {};
  try { const parsed: unknown = JSON.parse(raw || "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) m = parsed as Record<string, unknown>; } catch {}
  if (identity.startsWith("studio-panel-")) return "studio";
  if (identity.startsWith("studio-moderator-")) return m.panelMode === "moderator" ? "moderator" : m.accessRole === "admin" || m.roomAdmin === true ? "admin" : "moderator";
  for (const [prefix, role] of [["guest-","guest"],["output-","output"],["monitor-","monitor"],["talkback-","talkback"],["stream-viewer-","viewer"]]) if (identity.startsWith(prefix)) return role;
  return "other";
}

/** No browser/SDK media connection; only server API and retained diagnostic samples. */
export async function collectLocalNodeTopology() {
  const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) throw new Error("Local node diagnostics are not configured");
  const lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", key, secret);
  const [liveRooms, inventory] = await Promise.all([lk.listRooms(), readNodeRoomInventory()]);
  const configured = new Map(inventory.map(room => [mediaRoomName(room.studioId, room.name), room]));
  const liveNames = new Set(liveRooms.map(room => room.name));
  const names = [...new Set([...configured.keys(), ...liveNames])];
  const output: any[] = new Array(names.length);
  let next = 0;
  // Bound expensive history reads, instead of one unbounded Promise per room.
  const worker = async () => {
    while (next < names.length) {
      const index = next++, mediaRoom = names[index], record = configured.get(mediaRoom);
      const participants = liveNames.has(mediaRoom) ? await lk.listParticipants(mediaRoom) : [];
      const [history, state] = participants.length ? await Promise.all([
        readHistory(mediaRoom, 15).catch(() => null), readStudioState(mediaRoom).catch(() => null),
      ]) : [null, null];
      const primaryOnline = participants.some(participant => participant.identity === "studio-panel-main");
      output[index] = {
        mediaRoom, studioId: record?.studioId || null, name: record?.name || mediaRoom,
        configured: !!record, primaryOnline,
        onAir: primaryOnline && state ? state.desired.onAir === true : false,
        participantCount: participants.length,
        participants: participants.map(participant => {
          const latest = history?.connections.filter(connection => connection.identity === participant.identity).sort((a,b) => b.lastSeen-a.lastSeen)[0];
          const fresh = latest && Date.now()-latest.lastSeen < 35000;
          const streams = fresh ? latest.latest.streams : [];
          return {
            identity: participant.identity, name: participant.name || participant.identity,
            role: roleFor(participant.identity, participant.metadata),
            trackCount: participant.tracks?.length || 0,
            videoTrackCount: (participant.tracks || []).filter(track => track.source === TrackSource.CAMERA || track.source === TrackSource.SCREEN_SHARE).length,
            sources: Array.from(new Set((participant.tracks || []).map(track => String(track.source)))),
            state: "connected", lastSampleAt: latest?.lastSeen || null,
            bitrateInKbps: sumRates(streams,"in"), bitrateOutKbps: sumRates(streams,"out"),
            rttMs: mean(streams.map(stream => stream.rttMs)), jitterMs: mean(streams.map(stream => stream.jitterMs)),
            lossPct: mean(streams.map(stream => stream.lossPct)), reconnects: fresh ? latest.latest.reconnects : null,
          };
        }),
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(4,names.length) }, worker));
  return output;
}
