"use client";
import { useI18n } from "@/components/I18nProvider";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { setGuestCameraEnabled } from "@/lib/guest-video-codec";
import { watchGuestCameraEffects, type CameraEffect } from "@/lib/guest-camera-effects";
import type { GuestChoices } from "@/lib/guest-media";

export function GuestCodecCameraButton({ room, choicesRef, generation, disabled, onError }: { room: Room; choicesRef: RefObject<GuestChoices | undefined>; generation: RefObject<number>; disabled: boolean; onError: (error: string) => void }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(room.localParticipant.isCameraEnabled);
  const [busy, setBusy] = useState(false);
  const [effectBusy, setEffectBusy] = useState(false);
  const [effect, setEffect] = useState<CameraEffect>({ mode: "none" });
  const [open, setOpen] = useState(false);
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLButtonElement>(null);
  const effects = useRef<ReturnType<typeof watchGuestCameraEffects> | undefined>(undefined);
  const imageUrl = useRef<string | undefined>(undefined);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    const controller = watchGuestCameraEffects(room, message => onErrorRef.current(message));
    effects.current = controller;
    setEffect({ mode: "none" });
    setEffectBusy(false);
    return () => {
      effects.current = undefined;
      controller.stop();
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = undefined;
    };
  }, [room]);
  useEffect(() => {
    if (!open) return;
    const close = () => menu.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open]);
  const changeEffect = async (next: CameraEffect) => {
    const controller = effects.current;
    if (!controller || effectBusy || disabled || busy) {
      if (next.mode === "image") URL.revokeObjectURL(next.url);
      return;
    }
    setEffectBusy(true);
    try {
      await controller.setEffect(next);
      if (effects.current !== controller) {
        if (next.mode === "image") URL.revokeObjectURL(next.url);
        return;
      }
      const previousUrl = imageUrl.current;
      imageUrl.current = next.mode === "image" ? next.url : undefined;
      setEffect(next);
      onError("");
      if (previousUrl && previousUrl !== imageUrl.current) URL.revokeObjectURL(previousUrl);
    } catch (cause) {
      if (next.mode === "image" && next.url !== imageUrl.current) URL.revokeObjectURL(next.url);
      if (effects.current === controller) onError(cause instanceof Error ? cause.message : "Не удалось применить эффект камеры");
    } finally { if (effects.current === controller) setEffectBusy(false); }
  };
  const selectImage = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      onError(t("Выберите JPG, PNG или WebP до 10 МБ")); return;
    }
    void changeEffect({ mode: "image", url: URL.createObjectURL(file) });
  };
  const openEffects = () => {
    const popup = menu.current, trigger = arrow.current;
    if (!popup || !trigger) return;
    if (popup.matches(":popover-open")) { popup.hidePopover(); return; }
    const rect = trigger.getBoundingClientRect();
    popup.style.left = `${Math.max(12, Math.min(rect.right - 280, window.innerWidth - 292))}px`;
    popup.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
    popup.showPopover();
  };
  useEffect(() => {
    const update = () => setEnabled(room.localParticipant.isCameraEnabled);
    update();
    const events = [RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted];
    events.forEach(event => room.on(event, update));
    return () => { events.forEach(event => room.off(event, update)); };
  }, [room]);
  const toggle = async () => {
    const current = generation.current;
    setBusy(true);
    try { if (await setGuestCameraEnabled(room, !room.localParticipant.isCameraEnabled, () => choicesRef.current!, () => generation.current === current)) onError(""); }
    catch (cause) { if (generation.current === current) onError(cause instanceof Error ? cause.message : "Не удалось переключить камеру"); }
    finally { setEnabled(room.localParticipant.isCameraEnabled); setBusy(false); }
  };
  return <div className="guest-camera-control"><button type="button" className="lk-button lk-track-toggle" data-lk-source="camera" data-lk-enabled={enabled} aria-pressed={enabled} aria-label={enabled ? t("Выключить камеру") : t("Включить камеру")} disabled={disabled || busy || effectBusy} onClick={() => void toggle()}>
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" fill="none" stroke="currentColor" strokeWidth="2" />{!enabled && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />}</svg>
    <span>{enabled ? t("Камера") : t("Камера выключена")}</span>
  </button>
    <button ref={arrow} type="button" className="lk-button guest-camera-effects-toggle" aria-label={t("Фон и размытие камеры")} title={t("Фон и размытие камеры")} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} disabled={disabled || busy || effectBusy} onClick={openEffects}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    </button>
    <div ref={menu} id={id} popover="auto" role="dialog" aria-label={t("Фон и размытие камеры")} className="guest-camera-effects-menu" onToggle={() => setOpen(menu.current?.matches(":popover-open") === true)}>
      <h3>{t("Фон и размытие камеры")}</h3>
      <fieldset disabled={disabled || busy || effectBusy} aria-busy={effectBusy}>
        <legend className="sr-only">{t("Эффект камеры")}</legend>
        <label><input type="radio" name={id} checked={effect.mode === "none"} onChange={() => void changeEffect({ mode: "none" })} />{t("Без эффекта")}</label>
        <label><input type="radio" name={id} checked={effect.mode === "blur"} onChange={() => void changeEffect({ mode: "blur" })} />{t("Размытие фона")}</label>
        <label className="guest-camera-background-file"><span>{effect.mode === "image" ? t("Заменить фон") : t("Загрузить фон")}</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("Загрузить фон")} onChange={event => { selectImage(event.target.files?.[0]); event.target.value = ""; }} /></label>
      </fieldset>
      <p role="status">{effectBusy ? t("Применяем эффект…") : !enabled ? t("Эффект применится при включении камеры") : effect.mode === "image" ? t("Выбран свой фон") : t("Эффект виден всем участникам")}</p>
      <button type="button" className="button-secondary" onClick={() => { menu.current?.hidePopover(); arrow.current?.focus(); }}>{t("Закрыть")}</button>
    </div>
  </div>;
}
