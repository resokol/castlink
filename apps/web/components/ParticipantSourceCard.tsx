"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { useI18n } from "@/components/I18nProvider";
import { toggleElementFullscreen } from "@/lib/fullscreen";

export function PublishedSourcePreview({ track, stream, enabled = true, title }: { track?: LocalVideoTrack | RemoteVideoTrack; stream?: MediaStream; enabled?: boolean; title: string }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element || !enabled) return;
    if (track) track.attach(element);
    else if (stream) { element.srcObject = stream; void element.play().catch(() => undefined); }
    return () => { track?.detach(element); element.srcObject = null; };
  }, [track, stream, enabled]);
  const available = enabled && Boolean(track || stream);
  return <div className="control-participant-preview source-preview">
    <video ref={video} autoPlay playsInline muted hidden={!available} aria-label={title} style={{ display: available ? "block" : "none" }} />
    {!available && <span>{enabled ? t("{title} не включено", { title }) : t("Видео скрыто у вас")}</span>}
    <button type="button" className="preview-fullscreen" title={t("Во весь экран")} onClick={event => { const target = event.currentTarget.parentElement; if (target) void toggleElementFullscreen(target); }}>⛶</button>
  </div>;
}

export function ParticipantSourceCard({ sourceKey, name, kind, selected, preview, meter, monitoring, actions, advanced }: {
  sourceKey: string; name: string; kind: "camera" | "screen"; selected: boolean; preview: ReactNode; meter?: ReactNode; monitoring?: ReactNode; actions?: ReactNode; advanced?: ReactNode;
}) {
  const { t } = useI18n();
  return <article className="panel source-card" data-source-identity={sourceKey} data-source-selected={selected} data-video-source={kind === "screen" ? "screen_share" : "camera"}>
    <header className="source-card-heading"><strong>{name}</strong><small>{kind === "screen" ? t("Экран / приложение") : t("Камера")}</small></header>
    {preview}
    {meter && <div className="source-card-meter">{meter}</div>}
    {monitoring && <div className="source-card-monitor">{monitoring}</div>}
    {actions && <div className="source-card-actions">{actions}</div>}
    {advanced && <details className="source-card-advanced"><summary>{t("Настройки")}</summary><div className="source-card-advanced-content">{advanced}</div></details>}
  </article>;
}
