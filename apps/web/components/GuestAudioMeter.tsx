"use client";
import { useEffect, useState } from "react";
import type { RemoteAudioTrack } from "livekit-client";
import { METER_FLOOR_DB, observePcmTrack } from "@/lib/audio-meter";
import { AudioMeter } from "./AudioMeter";

export function GuestAudioMeter({ track, compact = false }: { track?: RemoteAudioTrack; fallbackDb?: number; compact?: boolean }) {
  const [db, setDb] = useState(METER_FLOOR_DB);
  const [detail, setDetail] = useState("");
  const mediaTrack = track?.mediaStreamTrack;
  useEffect(() => {
    setDb(METER_FLOOR_DB); setDetail("");
    if (!mediaTrack) return;
    try { return observePcmTrack(mediaTrack, setDb, () => !!track?.isMuted); }
    catch { setDetail("Измерение уровня недоступно в этом браузере."); }
  }, [track, mediaTrack]);
  return <AudioMeter db={db} compact={compact} detail={detail} />;
}
