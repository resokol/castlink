"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { useI18n } from "./I18nProvider";
import ImageTransformControls from "./multiview/ImageTransformControls";
import { validateImageTransform, type ImageTransform } from "@/lib/multiview-image";

const labels = {
  ru: { title: "Изображение кастера в студии", help: "Изменяет отображение в студии и индивидуальном видеовыходе.", apply: "Применить изображение", reset: "Сбросить в студии", saving: "Сохранение…", saved: "Изображение применено", offline: "Кастер не подключён", changed: "Кастер переподключился. Проверьте изображение и повторите.", error: "Не удалось сохранить изображение" },
  en: { title: "Caster image in the studio", help: "Changes the image displayed in the studio and individual video output.", apply: "Apply image", reset: "Reset in studio", saving: "Saving…", saved: "Image applied", offline: "Caster is offline", changed: "Caster reconnected. Check the image and try again.", error: "Could not save the image" },
  "zh-CN": { title: "工作室中的嘉宾图像", help: "更改工作室和独立视频输出中的显示图像。", apply: "应用图像", reset: "重置工作室图像", saving: "正在保存…", saved: "图像已应用", offline: "嘉宾未连接", changed: "嘉宾已重新连接。请检查图像后重试。", error: "无法保存图像" },
};

function participantImage(metadata?: string): ImageTransform {
  try { return validateImageTransform(JSON.parse(metadata || "{}").studioImageTransform || {}); }
  catch { return {}; }
}
const same = (a: ImageTransform, b: ImageTransform) => JSON.stringify(a) === JSON.stringify(b);

export function StudioCasterImageControls({ room, roomName, identity, studioId = "studio-default" }: { room: Room; roomName: string; identity: string; studioId?: string }) {
  const { locale } = useI18n();
  const c = labels[locale];
  const [draft, setDraft] = useState<ImageTransform>({}), [saved, setSaved] = useState<ImageTransform>({});
  const [sid, setSid] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const draftRef = useRef(draft), savedRef = useRef(saved), session = useRef(""), generation = useRef(0), request = useRef<AbortController | null>(null);
  draftRef.current = draft; savedRef.current = saved;
  useEffect(() => {
    const refresh = () => {
      const participant = room.remoteParticipants.get(identity);
      const nextSid = participant?.sid || "", value = participantImage(participant?.metadata);
      const replacement = nextSid !== session.current;
      if (replacement) {
        generation.current++; request.current?.abort(); request.current = null;
        session.current = nextSid; setSid(nextSid); setBusy(false); setError(""); setNotice("");
      }
      if (replacement || !same(value, savedRef.current)) {
        if (replacement || same(draftRef.current, savedRef.current)) { draftRef.current = value; setDraft(value); }
        savedRef.current = value; setSaved(value);
      }
    };
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantMetadataChanged, RoomEvent.Reconnected, RoomEvent.Disconnected];
    events.forEach(event => room.on(event, refresh)); refresh();
    return () => { generation.current++; request.current?.abort(); events.forEach(event => room.off(event, refresh)); };
  }, [room, identity, roomName, studioId]);

  const apply = async (value: ImageTransform) => {
    if (busy || !sid) return;
    const participantSid = sid, currentGeneration = generation.current;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/participants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "image-transform", studioId, room: roomName, identity, participantSid, transform: value }), signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 409 ? c.changed : c.error);
      const data = await response.json();
      if (currentGeneration !== generation.current || room.remoteParticipants.get(identity)?.sid !== participantSid) return;
      const accepted = validateImageTransform(data.transform);
      draftRef.current = accepted; savedRef.current = accepted; setDraft(accepted); setSaved(accepted); setNotice(c.saved);
    } catch (failure) {
      if (!controller.signal.aborted && currentGeneration === generation.current) setError(failure instanceof Error ? failure.message : c.error);
    } finally {
      if (currentGeneration === generation.current) { setBusy(false); request.current = null; }
    }
  };
  return <section className="studio-caster-image-controls" aria-label={c.title}>
    <strong>{c.title}</strong><p className="muted">{c.help}</p>
    <ImageTransformControls value={draft} disabled={busy || !sid} onChange={value => { setDraft(value); setNotice(""); setError(""); }} />
    <div className="guest-card-controls"><button type="button" disabled={busy || !sid || same(draft, saved)} onClick={() => void apply(draft)}>{busy ? c.saving : c.apply}</button><button type="button" disabled={busy || !sid} onClick={() => void apply({})}>{c.reset}</button></div>
    {!sid && <small>{c.offline}</small>}{error && <small role="alert">{error}</small>}{notice && <small role="status">{notice}</small>}
  </section>;
}
