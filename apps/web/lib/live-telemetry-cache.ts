import type { TelemetrySample } from "./telemetry-types";
import type { OutputTrackRate } from "./guest-receive-bitrate";
type Cache = {samples:Map<string,TelemetrySample>; warmed:Set<string>; loading:Map<string,Promise<void>>};
const globalCache = globalThis as typeof globalThis & {__castlinkLiveTelemetry?:Cache};
const cache:Cache = globalCache.__castlinkLiveTelemetry ||= {samples:new Map(),warmed:new Set(),loading:new Map()};
const keyOf=(sample:TelemetrySample)=>`${sample.room}\0${sample.identity}`;
export function rememberLiveSample(sample:TelemetrySample) {
  const key=keyOf(sample),previous=cache.samples.get(key);
  if(previous && previous.at>sample.at) return;
  cache.samples.delete(key); cache.samples.set(key,sample);
  while(cache.samples.size>4096) cache.samples.delete(cache.samples.keys().next().value!);
}
export async function latestLiveSamples(room:string, seed:()=>Promise<TelemetrySample[]>):Promise<Map<string,TelemetrySample>> {
  if(!cache.warmed.has(room)) {
    let loading=cache.loading.get(room);
    if(!loading) {
      loading=(async()=>{for(const sample of await seed()) rememberLiveSample(sample);cache.warmed.add(room);while(cache.warmed.size>512) cache.warmed.delete(cache.warmed.values().next().value!);})();
      cache.loading.set(room,loading);
    }
    try {await loading;} finally {cache.loading.delete(room);}
  }
  return new Map([...cache.samples.values()].filter(s=>s.room===room).map(s=>[s.identity,s]));
}
export function resetLiveTelemetryForTests(){cache.samples.clear();cache.warmed.clear();cache.loading.clear();}

/** One value per output receiver and publication, with only its inbound RTP streams combined. */
export function liveOutputRates(room: string, now = Date.now()) {
  const result: OutputTrackRate[] = [];
  for (const sample of cache.samples.values()) {
    const ttlMs = 8000 - (now - sample.at);
    if (sample.room !== room || sample.role !== "output" || sample.state !== "connected" || ttlMs <= 0 || ttlMs > 8000) continue;
    const totals = new Map<string, { participant: string; kbps: number }>();
    for (const stream of sample.streams) {
      if (stream.direction !== "in" || !stream.trackSid || stream.bitrateKbps == null) continue;
      if (!(stream.kind === "video" && stream.source === "camera") && !(stream.kind === "audio" && stream.source === "microphone")) continue;
      const prev = totals.get(stream.trackSid);
      totals.set(stream.trackSid, { participant: stream.participant, kbps: (prev?.kbps ?? 0) + stream.bitrateKbps });
    }
    for (const [trackSid, total] of totals) {
      result.push({ receiver: sample.identity, participant: total.participant, trackSid, kbps: Math.round(total.kbps), ttlMs });
    }
  }
  return result;
}
