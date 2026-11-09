"use client";
import { useI18n } from "@/components/I18nProvider";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { setGuestCameraEnabled } from "@/lib/guest-video-codec";
import { cameraBlurRadius, watchGuestCameraEffects, type CameraEffect } from "@/lib/guest-camera-effects";
import type { GuestChoices } from "@/lib/guest-media";
import { GuestMediaMenu } from "./GuestMediaMenu";
import styles from "./GuestCodecCameraButton.module.css";

export function GuestCodecCameraButton({ room, choicesRef, generation, disabled, onError, menuContent }: { menuContent?: ReactNode; room: Room; choicesRef: RefObject<GuestChoices | undefined>; generation: RefObject<number>; disabled: boolean; onError: (error: string) => void }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(room.localParticipant.isCameraEnabled);
  const [busy, setBusy] = useState(false);
  const [effectBusy, setEffectBusy] = useState(false);
  const [effect, setEffect] = useState<CameraEffect>({ mode: "none" });
  const [blurRadius, setBlurRadius] = useState(10);
  const id = useId();
  const effects = useRef<ReturnType<typeof watchGuestCameraEffects> | undefined>(undefined);
  const imageUrl = useRef<string | undefined>(undefined);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    const controller = watchGuestCameraEffects(room, message => onErrorRef.current(message));
    effects.current = controller;
    setEffect({ mode: "none" });
    setBlurRadius(10);
    setEffectBusy(false);
    return () => {
      effects.current = undefined;
      controller.stop();
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = undefined;
    };
  }, [room]);
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
      if (next.mode === "blur" && effects.current === controller) setBlurRadius(effect.mode === "blur" ? cameraBlurRadius(effect.blurRadius) : 10);
      if (next.mode === "image" && next.url !== imageUrl.current) URL.revokeObjectURL(next.url);
      if (effects.current === controller) onError(cause instanceof Error ? cause.message : "Не удалось применить эффект камеры");
    } finally { if (effects.current === controller) setEffectBusy(false); }
  };
  useEffect(() => {
    if (effect.mode !== "blur" || cameraBlurRadius(effect.blurRadius) === blurRadius || disabled || busy || effectBusy) return;
    const timer = setTimeout(() => { void changeEffect({ mode: "blur", blurRadius }); }, 120);
    return () => clearTimeout(timer);
  }, [blurRadius, effect, disabled, busy, effectBusy]);
  const selectImage = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      onError(t("Выберите JPG, PNG или WebP до 10 МБ")); return;
    }
    void changeEffect({ mode: "image", url: URL.createObjectURL(file) });
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
  return <div className="guest-camera-control" data-muted={!enabled}><button type="button" className="lk-button lk-track-toggle" data-lk-source="camera" data-lk-enabled={enabled} aria-pressed={enabled} title={enabled ? t("Выключить камеру") : t("Включить камеру")} aria-label={enabled ? t("Выключить камеру") : t("Включить камеру")} disabled={disabled || busy || effectBusy} onClick={() => void toggle()}>
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" fill="none" stroke="currentColor" strokeWidth="2" />{!enabled && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />}</svg>
    <span>{enabled ? t("Камера") : t("Камера выключена")}</span>
  </button>
    <GuestMediaMenu label={t("Настройки камеры")} disabled={disabled || busy || effectBusy} className="guest-camera-effects-menu" triggerClassName="guest-camera-effects-toggle">
      <h3>{t("Настройки камеры")}</h3>
      {menuContent}
      <h3>{t("Фон и размытие камеры")}</h3>
      <fieldset disabled={disabled || busy || effectBusy} aria-busy={effectBusy}>
        <legend className="sr-only">{t("Эффект камеры")}</legend>
        <label><input type="radio" name={id} checked={effect.mode === "none"} onChange={() => void changeEffect({ mode: "none" })} />{t("Без эффекта")}</label>
        <label><input type="radio" name={id} checked={effect.mode === "blur"} onChange={() => void changeEffect({ mode: "blur", blurRadius })} />{t("Размытие фона")}</label>
        <label className="guest-camera-background-file"><span>{effect.mode === "image" ? t("Заменить фон") : t("Загрузить фон")}</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("Загрузить фон")} onChange={event => { selectImage(event.target.files?.[0]); event.target.value = ""; }} /></label>
      </fieldset>
      {effect.mode === "blur" && <div className={styles.strength}>
        <div><label htmlFor={`${id}-strength`}>{t("Сила размытия")}</label><output htmlFor={`${id}-strength`}>{blurRadius}</output></div>
        <input id={`${id}-strength`} type="range" min={1} max={30} step={1} value={blurRadius} aria-label={t("Сила размытия")} disabled={disabled || busy} onChange={event => setBlurRadius(cameraBlurRadius(Number(event.target.value)))} />
      </div>}
      <p role="status">{effectBusy ? t("Применяем эффект…") : !enabled ? t("Эффект применится при включении камеры") : effect.mode === "image" ? t("Выбран свой фон") : t("Эффект виден всем участникам")}</p>
    </GuestMediaMenu>
  </div>;
}
