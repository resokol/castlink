import type { TelemetrySample } from "./telemetry-types";
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
