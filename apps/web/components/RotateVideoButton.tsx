"use client";
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";
import { useState } from "react";
export function RotateVideoButton({ roomName, identity, studioId = "studio-default" }: { roomName: string; identity: string; studioId?: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <><button type="button" disabled={busy} title={t("Повернуть видео для всех участников и выхода vMix")} onClick={async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/participants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rotate", studioId, room: roomName, identity }) });
      if (!response.ok) throw Error("Не удалось повернуть видео");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка поворота"); } finally { setBusy(false); }
  }}>{t("↻ Повернуть на 90°")}</button>{error && <small role="alert">{translateManagementMessage(error, t)}</small>}</>;
}
