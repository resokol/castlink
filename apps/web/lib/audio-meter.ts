export const METER_FLOOR_DB = -90;
export function peakDbfs(samples: ArrayLike<number>) {
  let peak = 0;
  for (let i=0;i<samples.length;i++) if (Number.isFinite(samples[i])) peak = Math.max(peak,Math.abs(samples[i]));
  return peak > 0 ? Math.max(METER_FLOOR_DB,Math.min(0,20*Math.log10(peak))) : METER_FLOOR_DB;
}
/** Display-only ballistic release. Never alters audio samples or applies an audio gate. */
export function meterRelease(previous: number, measured: number, elapsedMs: number) {
  if (!Number.isFinite(measured) || measured <= METER_FLOOR_DB) return METER_FLOOR_DB;
  return Math.max(METER_FLOOR_DB,measured,previous-90*Math.min(250,Math.max(0,elapsedMs))/1000);
}

/** Observe actual PCM only. The caller owns the track; disposal never stops it. */
export function observePcmTrack(track: MediaStreamTrack, onLevel: (db: number) => void, muted: () => boolean = () => false) {
  const context = new AudioContext({ latencyHint: "interactive" });
  let frame = 0, stopped = false, shown = METER_FLOOR_DB, lastTick = 0;
  let source: MediaStreamAudioSourceNode | undefined, analyser: AnalyserNode | undefined, sink: GainNode | undefined;
  const resume = () => { if (context.state === "suspended") void context.resume().catch(() => undefined); };
  const stop = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame);
    document.removeEventListener("pointerdown", resume); document.removeEventListener("keydown", resume);
    for (const node of [source, analyser, sink]) { try { node?.disconnect(); } catch {} }
    void context.close().catch(() => undefined);
  };
  try {
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0;
    source = context.createMediaStreamSource(new MediaStream([track]));
    sink = context.createGain(); sink.gain.value = 0;
    source.connect(analyser); analyser.connect(sink); sink.connect(context.destination);
    const samples = new Float32Array(analyser.fftSize);
    const tick = (at: number) => {
      if (stopped) return;
      if (at - lastTick >= 33) {
        analyser!.getFloatTimeDomainData(samples);
        const unavailable = track.readyState !== "live" || track.muted || muted() || context.state !== "running";
        const measured = unavailable ? METER_FLOOR_DB : peakDbfs(samples);
        shown = unavailable ? METER_FLOOR_DB : meterRelease(shown, measured, lastTick ? at - lastTick : 33);
        lastTick = at; onLevel(Math.round(shown * 10) / 10);
      }
      frame = requestAnimationFrame(tick);
    };
    resume(); document.addEventListener("pointerdown", resume); document.addEventListener("keydown", resume);
    frame = requestAnimationFrame(tick);
    return stop;
  } catch (error) { stop(); throw error; }
}
