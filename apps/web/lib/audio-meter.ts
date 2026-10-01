export const METER_FLOOR_DB = -90;
export function peakDbfs(samples: ArrayLike<number>) {
  let peak = 0;
  for (let i=0;i<samples.length;i++) if (Number.isFinite(samples[i])) peak = Math.max(peak,Math.abs(samples[i]));
  return peak > 0 ? Math.max(METER_FLOOR_DB,Math.min(0,20*Math.log10(peak))) : METER_FLOOR_DB;
}
/** Display-only ballistic release. Never alters audio samples or applies an audio gate. */
export function meterRelease(previous: number, measured: number, elapsedMs: number) {
  return Math.max(METER_FLOOR_DB,measured,previous-24*Math.min(250,Math.max(0,elapsedMs))/1000);
}
