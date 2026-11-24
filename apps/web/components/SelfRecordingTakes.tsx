"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import { deleteTake, listTakes, readTake, takeExtension, type LocalTake } from "@/lib/self-recording";
import styles from "./SelfRecording.module.css";

export function SelfRecordingTakes({ revision }: { revision: number }) {
  const { t, locale } = useI18n();
  const [takes, setTakes] = useState<LocalTake[]>([]);
  const [changed, setChanged] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(null);
  const generation = useRef(0);
  const temporaryUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = temporaryUrls.current;
    return () => { generation.current += 1; for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => { void listTakes().then(rows => {
      if (active) setTakes(rows.filter(row => row.status !== "recording" && row.bytes > 0));
    }).catch(() => { if (active) setError("Не удалось открыть локальное хранилище записей."); }); };
    refresh(); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [revision, changed]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function open(take: LocalTake, download: boolean) {
    const request = ++generation.current;
    setBusy(take.id); setError("");
    try {
      const video = await readTake(take.id);
      if (request !== generation.current) return;
      const url = URL.createObjectURL(video);
      if (!download) { setPreview({ id: take.id, url }); return; }
      const link = document.createElement("a");
      link.href = url;
      link.download = `CastLink-${new Date(take.startedAt).toISOString().replace(/[:.]/g, "-")}.${takeExtension(take.mime)}`;
      temporaryUrls.current.add(url);
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => {
        if (temporaryUrls.current.delete(url)) URL.revokeObjectURL(url);
      }, 60_000);
    } catch { if (request === generation.current) setError("Не удалось прочитать запись. Попробуйте ещё раз."); }
    finally { if (request === generation.current) setBusy(""); }
  }

  async function remove(id: string) {
    if (!window.confirm(t("Удалить эту запись из браузера?"))) return;
    setBusy(id); setError("");
    try {
      await deleteTake(id);
      if (preview?.id === id) setPreview(null);
      setChanged(value => value + 1);
    } catch { setError("Не удалось удалить запись."); }
    finally { setBusy(""); }
  }

  if (!takes.length && !error) return null;
  return <section className={styles.library} aria-label={t("Записи на этом устройстве")}>
    <h2>{t("Записи на этом устройстве")}</h2>
    <p>{t("Скачайте нужные дубли до очистки данных браузера.")}</p>
    {error && <p role="alert">{t(error)}</p>}
    {takes.map(take => <article key={take.id} className={styles.take}>
      <div><strong>{new Date(take.startedAt).toLocaleString(locale)}</strong>
        <small>{takeExtension(take.mime).toUpperCase()} · {Intl.NumberFormat(locale, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }).format(take.bytes / 1_000_000)}
          {take.status === "partial" && <> · {t("Запись прервалась. Доступна сохранённая часть.")}</>}</small></div>
      <div className={styles.actions}>
        <button type="button" disabled={!!busy} onClick={() => void open(take, true)}>{t("Скачать видео")}</button>
        <button type="button" disabled={!!busy} onClick={() => preview?.id === take.id ? setPreview(null) : void open(take, false)}>{t(preview?.id === take.id ? "Скрыть просмотр" : "Посмотреть")}</button>
        <button type="button" disabled={!!busy} onClick={() => void remove(take.id)}>{t("Удалить")}</button>
      </div>
      {preview?.id === take.id && <video className={styles.playback} controls playsInline src={preview.url} />}
    </article>)}
  </section>;
}
