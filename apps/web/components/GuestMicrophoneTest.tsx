"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { AudioMeter } from "./AudioMeter";
import { guestAudioCaptureOptions } from "@/lib/guest-audio";
import type { GuestChoices } from "@/lib/guest-media";
import { METER_FLOOR_DB, observePcmTrack } from "@/lib/audio-meter";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";

/** A local, silent test never publishes or unmutes the conference microphone. */
export function GuestMicrophoneTest({ choices, disabled }: { choices?: GuestChoices; disabled: boolean }) {
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(METER_FLOOR_DB);
  const [error, setError] = useState("");
  const attempt = useRef(0);
  const stream = useRef<MediaStream | undefined>(undefined);
  const meter = useRef<(() => void) | undefined>(undefined);
  const stop = () => {
    attempt.current++;
    meter.current?.(); meter.current = undefined;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = undefined;
    setTesting(false); setLevel(METER_FLOOR_DB);
  };
  useEffect(() => {
    stop();
    return stop;
  }, [choices?.audioDeviceId, choices?.audioProfile, disabled]);
  const start = async () => {
    if (testing) { stop(); return; }
    if (disabled) return;
    const current = ++attempt.current;
    setTesting(true); setError("");
    let captured: MediaStream | undefined;
    try {
      captured = await navigator.mediaDevices.getUserMedia({ audio: guestAudioCaptureOptions(choices || {}), video: false });
      if (current !== attempt.current) { captured.getTracks().forEach(track => track.stop()); return; }
      stream.current = captured;
      const track = captured.getAudioTracks()[0];
      if (!track) throw new Error("Не удалось открыть устройства");
      meter.current = observePcmTrack(track, db => { if (current === attempt.current) setLevel(db); });
    } catch (cause) {
      if (current === attempt.current) {
        stop(); setError(cause instanceof Error ? cause.message : "Не удалось открыть устройства");
      } else captured?.getTracks().forEach(track => track.stop());
    }
  };
  return <div className="guest-microphone-test">
    <button type="button" className="button-secondary" disabled={disabled} aria-pressed={testing} onClick={() => void start()}>{t(testing ? "Остановить тест микрофона" : "Проверить микрофон")}</button>
    {testing && <><AudioMeter db={level} compact /><p>{t("Говорите в микрофон: шкала показывает реальный сигнал. Звук микрофона не воспроизводится в динамиках.")}</p></>}
    {error && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, error)}</p>}
  </div>;
}
