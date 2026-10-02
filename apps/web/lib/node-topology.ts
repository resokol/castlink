import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { readNodeRoomInventory } from "./room-store";
import { mediaRoomName } from "./studio-scope";
import { latestLiveSamples } from "./live-telemetry-cache";
import { readHistory } from "./telemetry-store";
import { readStudioState } from "./studio-control";
import { mean, sumRates, type TelemetrySample } from "./telemetry-types";

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
      let participants: Awaited<ReturnType<typeof lk.listParticipants>> = [];
      try { participants = liveNames.has(mediaRoom) ? await lk.listParticipants(mediaRoom) : []; }
      catch {
        output[index] = { mediaRoom,studioId:record?.studioId || null,name:record?.name || mediaRoom,configured:!!record,participantCount:null,participants:[],topologyAvailable:false,error:"room_snapshot_unavailable",onAir:null };
        continue;
      }
      const [latestByIdentity,state]=participants.length ? await Promise.all([
        latestLiveSamples(mediaRoom,async()=>(await readHistory(mediaRoom,15)).connections.map(c=>c.latest)).catch(()=>new Map<string,TelemetrySample>()),
        readStudioState(mediaRoom).catch(()=>null),
      ]) : [new Map<string,TelemetrySample>(),null];
      const primaryOnline = participants.some(participant => participant.identity === "studio-panel-main");
      const observedScopes = new Set<string>();
      for (const participant of participants) { try { const value=JSON.parse(participant.metadata || "{}"); if(typeof value.studioId==="string") observedScopes.add(value.studioId); } catch {} }
      const observedStudioId = observedScopes.size===1 ? [...observedScopes][0] : null;
      output[index] = {
        mediaRoom, studioId: record?.studioId || observedStudioId, name: record?.name || mediaRoom,
        configured: !!record, primaryOnline,
        onAir: primaryOnline && state ? state.desired.onAir === true : false,
        participantCount: participants.length,
        participants: participants.map(participant => {
          const latest = latestByIdentity.get(participant.identity);
          const fresh = latest && Date.now()-latest.at < 35000;
          const streams = fresh ? latest.streams : [];
          return {
            identity: participant.identity, sid:participant.sid, name: participant.name || participant.identity,
            role: roleFor(participant.identity, participant.metadata),
            trackCount: participant.tracks?.length || 0,
            videoTrackCount: (participant.tracks || []).filter(track => track.source === TrackSource.CAMERA || track.source === TrackSource.SCREEN_SHARE).length,
            sources: Array.from(new Set((participant.tracks || []).map(track => String(track.source)))),
            state: "connected", lastSampleAt: latest?.at || null,
            telemetryFresh:!!fresh, quality:fresh ? latest.quality : null, uptimeSec:fresh ? latest.uptimeSec : null,
            streams, sampleSession:latest?.session || null,
            tracks:(participant.tracks || []).map(track=>({sid:track.sid,source:String(track.source),muted:track.muted,width:track.width,height:track.height})),
            bitrateInKbps: fresh ? sumRates(streams,"in") : null, bitrateOutKbps: fresh ? sumRates(streams,"out") : null,
            rttMs: mean(streams.map(stream => stream.rttMs)), jitterMs: mean(streams.map(stream => stream.jitterMs)),
            lossPct: mean(streams.map(stream => stream.lossPct)), reconnects: fresh ? latest.reconnects : null,
          };
        }),
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(4,names.length) }, worker));
  return output;
}
