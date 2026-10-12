"use client";
import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";


export type StudioDevicePatch = { videoDeviceId?: string; audioDeviceId?: string; outputDeviceId?: string };
type Device = { deviceId: string; label: string; kind: string };
type Props = {
  actual?: Record<string, unknown> | null;
  desired?: { videoDeviceId?: string | null; audioDeviceId?: string | null; outputDeviceId?: string | null; deviceRevision?: number; onAir?: boolean };
  online: boolean;
  disabled?: boolean;
  onChange: (patch: StudioDevicePatch) => void;
};

export function RemoteStudioDevices({ actual, desired, online, disabled, onChange }: Props) {
  const { t, locale } = useI18n();
  const devices = (Array.isArray(actual?.devices) ? actual.devices : []).filter((device): device is Device =>
    !!device && typeof device.deviceId === "string" && typeof device.label === "string" && typeof device.kind === "string");
  const pending = online && (Number(desired?.deviceRevision || 0) > Number(actual?.deviceRevisionApplied || 0) || actual?.deviceBusy === true);
  const inputsLocked = desired?.onAir === true || actual?.onAir === true || actual?.airBusy === true;
  const fields = [
    { key: "videoDeviceId", kind: "videoinput", label: t("Камера основной студии") },
    { key: "audioDeviceId", kind: "audioinput", label: t("Микрофон основной студии") },
    { key: "outputDeviceId", kind: "audiooutput", label: t("Динамики / наушники основной студии") },
  ] as const;
  return <section className="panel stack" aria-label={t("Устройства основной студии")}>
    <h2>{t("Устройства основной студии")}</h2>
    <div className="media-device-picker">
      {fields.map(({ key, kind, label }) => {
        const options = devices.filter(device => device.kind === kind);
        const value = pending && typeof desired?.[key] === "string" ? desired[key] : typeof actual?.[key] === "string" ? actual[key] as string : "";
        return <label key={key}>{label}<select aria-label={label} value={value || ""}
          disabled={disabled || !online || pending || !options.length || (kind !== "audiooutput" && inputsLocked)}
          onChange={event => onChange({ [key]: event.target.value })}>
          {!options.some(device => device.deviceId === value) && <option value={value || ""}>{value ? t("Устройство недоступно") : t("Выберите устройство")}</option>}
          {options.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label === "Системный выход" ? t("Системный выход") : device.label || `${label} ${index + 1}`}</option>)}
        </select></label>;
      })}
    </div>
    <small className="muted">{t("Это устройства компьютера основной студии. Для смены камеры и микрофона выключите эфир.")}</small>
    {!online ? <p role="status">{t("Основная студия не подключена.")}</p> : !devices.length ? <p role="status">{t("Ожидаем список устройств. Разрешите доступ к ним в основной студии.")}</p> : null}
    {pending && <p role="status">{t("Основная студия применяет выбор…")}</p>}
    {typeof actual?.deviceError === "string" && actual.deviceError && <p className="media-device-error" role="alert">{translateWorkspaceMessage(t, actual.deviceError)}</p>}
    {online && actual?.preview === false && <small className="muted">{t("Захват выбранной камеры и микрофона начнётся при включении проверки Studio Return.")}</small>}
  </section>;
}
