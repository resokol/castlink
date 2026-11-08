"use client";

import { useEffect, useState, type RefObject } from "react";
import { METER_FLOOR_DB, peakDbfs } from "@/lib/audio-meter";
import { AudioMeter } from "./AudioMeter";

/** Reuse the capture graph; animation updates only this small meter. */
export function StudioReturnAudioMeter({ analyserRef, muted, label, vertical = false }: {
  analyserRef: RefObject<AnalyserNode | undefined>; muted: boolean; label: string; vertical?: boolean;
}) {
  const [db, setDb] = useState(METER_FLOOR_DB);
  useEffect(() => {
    let frame = 0, stopped = false, samples = new Float32Array(0);
    const tick = () => {
      if (stopped) return;
      let level = METER_FLOOR_DB;
      try {
        const analyser = analyserRef.current;
        if (!muted && analyser && analyser.context.state === "running") {
          if (samples.length !== analyser.fftSize) samples = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(samples);
          level = Math.round(peakDbfs(samples) * 10) / 10;
        }
      } catch { /* A disposed graph must not interrupt capture or publication. */ }
      setDb(level);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [analyserRef, muted]);
  return <AudioMeter db={muted ? METER_FLOOR_DB : db} label={label} vertical={vertical} />;
}
