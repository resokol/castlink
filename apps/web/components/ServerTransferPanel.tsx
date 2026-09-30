"use client";

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
  return <section className="transfer-compact" aria-label="Серверы переноса комнаты">
    <div>
      <p className="eyebrow">ПЕРЕНОС КОМНАТЫ</p>
      <strong>{info.current?.label || "Текущий сервер"}</strong>
      <p className="muted">Переносит комнату вместе с подключёнными участниками.</p>
    </div>
    <div className="transfer-server-list">
      {info.loading && <span className="muted">Загружаем серверы…</span>}
      {info.error && <span className="transfer-server-error" role="status">{info.error}</span>}
      {!info.loading && !info.error && !info.targets.length && <span className="muted">Другие серверы не настроены.</span>}
      {info.targets.map(target => <div className="transfer-server-row" key={target.id}>
        <span><strong>{target.label}</strong><small>{target.available ? "Доступен" : target.reason || "Недоступен"}</small></span>
        <span className={target.available ? "transfer-available" : "transfer-unavailable"}>{target.available ? "Готов" : "Недоступен"}</span>
      </div>)}
      {!!info.targets.length && <div className="transfer-start-row">
        <select aria-label="Целевой сервер" value={targetId} onChange={event => onTargetChange(event.target.value)}>
          <option value="">Выберите сервер…</option>
          {info.targets.map(target => <option key={target.id} value={target.id} disabled={!target.available}>{target.label}{target.available ? "" : " · недоступен"}</option>)}
        </select>
        <button type="button" className="button-primary" disabled={!targetId || busy || info.loading} onClick={onStart}>{busy ? "Подготовка…" : "Перенести"}</button>
      </div>}
      {error && <span className="transfer-server-error" role="alert">{error}</span>}
      <button type="button" className="button-secondary" disabled={info.loading} onClick={onRefresh}>Обновить список</button>
    </div>
  </section>;
}
