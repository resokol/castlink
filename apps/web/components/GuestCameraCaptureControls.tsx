"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "./I18nProvider";
import { CAMERA_FRAME_RATES, CAMERA_RESOLUTIONS, type GuestCameraCapture } from "../lib/guest-capture-settings";
import type { GuestMediaSettingsPatch, GuestMediaSettingsState } from "../lib/guest-media-control";

const initialCapture: GuestCameraCapture = { mode: "device", resolution: "1920x1080", frameRate: "30" };
const equalCapture = (a: GuestCameraCapture, b: GuestCameraCapture) =>
  a.mode === b.mode && a.resolution === b.resolution && a.frameRate === b.frameRate;

export function GuestCameraCaptureControls({ state, disabled, name, onChange }: {
  state?: GuestMediaSettingsState;
  disabled: boolean;
  name: string;
  onChange: (patch: GuestMediaSettingsPatch) => void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const confirmed = state?.cameraCapture ?? initialCapture;
  const [draft, setDraft] = useState<GuestCameraCapture>(confirmed);
  useEffect(() => { setDraft(confirmed); }, [confirmed.mode, confirmed.resolution, confirmed.frameRate]);
  const unavailable = state?.cameraCaptureSupported !== true;
  const locked = disabled || unavailable;
  const dirty = !state?.cameraCapture || !equalCapture(draft, confirmed);
  const actual = state?.videoEnabled !== false ? state?.actualCameraCapture : undefined;
  return <fieldset className="guest-capture-settings" aria-describedby={id + "-help"}>
    <legend>{t("Параметры камеры")}</legend>
    <div className="guest-capture-fields">
      <label className="guest-capture-mode">{t("Режим разрешения и FPS")}
        <select aria-label={t("Режим камеры — {name}", { name })} value={draft.mode} disabled={locked}
          onChange={event => setDraft(current => ({ ...current, mode: event.target.value as GuestCameraCapture["mode"] }))}>
          <option value="device">{t("Стандартные значения устройства")}</option>
          <option value="custom">{t("Пользовательское")}</option>
        </select>
      </label>
      <label>{t("Разрешение")}
        <select aria-label={t("Разрешение камеры — {name}", { name })} value={draft.resolution} disabled={locked || draft.mode === "device"}
          onChange={event => setDraft(current => ({ ...current, resolution: event.target.value as GuestCameraCapture["resolution"] }))}>
          {CAMERA_RESOLUTIONS.map(resolution => <option key={resolution} value={resolution}>{resolution.replace("x", " × ")}</option>)}
        </select>
      </label>
      <label>{t("Частота кадров")}
        <select aria-label={t("Частота кадров камеры — {name}", { name })} value={draft.frameRate} disabled={locked || draft.mode === "device"}
          onChange={event => setDraft(current => ({ ...current, frameRate: event.target.value as GuestCameraCapture["frameRate"] }))}>
          {CAMERA_FRAME_RATES.map(rate => <option key={rate} value={rate}>{rate === "highest" ? t("Наибольшая частота кадров") : rate === "29.97" ? "29.97 NTSC" : rate === "24" ? "24 film" : rate + " FPS"}</option>)}
        </select>
      </label>
    </div>
    <p className="guest-capture-actual" role="status"><span>{t("Камера · факт")}</span><output>{actual
      ? t("{width} × {height} · {fps} FPS", { width: actual.width, height: actual.height, fps: actual.frameRate.toLocaleString(locale, { maximumFractionDigits: 2 }) })
      : state?.videoEnabled === false ? t("Камера выключена") : "—"}</output></p>
    <small id={id + "-help"}>{!state ? t("Ожидаем состояние гостя…") : unavailable
      ? t("Браузер гостя не поддерживает управление камерой или вкладка использует прежнюю версию.")
      : state?.videoEnabled === false
        ? t("Выбор сохранится у гостя и применится при включении камеры.")
        : t("Камера может выбрать ближайшие поддерживаемые значения. Фактические параметры показаны выше.")}</small>
    <div className="guest-capture-actions">
      <button type="button" disabled={locked || !dirty} onClick={() => onChange({ cameraCapture: draft })}>{t("Применить")}</button>
      <button type="button" className="button-secondary" disabled={disabled || !dirty} onClick={() => setDraft(confirmed)}>{t("Отмена")}</button>
    </div>
    <details className="guest-capture-platform"><summary>{t("Формат и поведение камеры")}</summary>
      <dl>
        <div><dt>{t("Формат видео")}</dt><dd>{t("Автоматически · браузер")}</dd></div>
        <div><dt>{t("Цветовое пространство")}</dt><dd>{t("По умолчанию · браузер")}</dd></div>
      </dl>
      <small>{t("YUY2, MJPEG и цветовое пространство настраиваются в драйвере камеры или OBS. Браузер не предоставляет эти настройки.")}</small>
      <small>{t("Сворачивание карточки сохраняет передачу гостя. Камера выключается отдельной кнопкой управления видео.")}</small>
    </details>
  </fieldset>;
}
