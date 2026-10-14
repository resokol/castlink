"use client";
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";

export type TransferTarget = {
  id: string;
  label: string;
  origin: string;
  available: boolean;
  reason?: string;
};

export type TransferInfo = {
  current?: { id: string; label: string };
  targets: TransferTarget[];
  error?: string;
  loading: boolean;
};

export function ServerTransferPanel({
  info,
  targetId,
  busy,
  error,
  onTargetChange,
  onStart,
  onRefresh,
}: {
  info: TransferInfo;
  targetId: string;
  busy: boolean;
  error: string;
  onTargetChange: (targetId: string) => void;
  onStart: () => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  return <section className="transfer-compact" aria-label={t("Серверы переноса комнаты")}>
    <div>
      <p className="eyebrow">{t("ПЕРЕНОС КОМНАТЫ")}</p>
      <strong>{info.current?.label || t("Текущий сервер")}</strong>
      <p className="muted">{t("Переносит комнату вместе с подключёнными участниками.")}</p>
      <p className="muted">{t("Доступность сервера проверяется сейчас. Подготовка аварийного резерва и автоматический перенос показаны отдельно.")}</p>
    </div>
    <div className="transfer-server-list">
      {info.loading && <span className="muted">{t("Загружаем серверы…")}</span>}
      {info.error && <span className="transfer-server-error" role="status">{translateManagementMessage(info.error, t)}</span>}
      {!info.loading && !info.error && !info.targets.length && <span className="muted">{t("Другие серверы не настроены.")}</span>}
      {info.targets.map(target => <div className="transfer-server-row" key={target.id}>
        <span style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{target.label}</strong><small>{target.origin}</small>{!target.available&&<small>{target.reason ? translateManagementMessage(target.reason, t) : t("Недоступен")}</small>}</span>
        <span className={target.available ? "transfer-available" : "transfer-unavailable"}>{target.available ? t("Доступен") : t("Недоступен")}</span>
      </div>)}
      {!!info.targets.length && <div className="transfer-start-row">
        <select aria-label={t("Целевой сервер")} disabled={busy||info.loading} value={targetId} onChange={event => onTargetChange(event.target.value)}>
          <option value="">{t("Выберите сервер…")}</option>
          {info.targets.map(target => <option key={target.id} value={target.id} disabled={!target.available}>{target.label}{target.available ? "" : t(" · недоступен")}</option>)}
        </select>
        <button type="button" className="button-primary" disabled={!targetId || busy || info.loading} onClick={onStart}>{busy ? t("Подготовка…") : t("Перенести")}</button>
      </div>}
      {error && <span className="transfer-server-error" role="alert">{translateManagementMessage(error, t)}</span>}
      <button type="button" className="button-secondary" disabled={info.loading} onClick={onRefresh}>{t("Обновить список")}</button>
    </div>
  </section>;
}
