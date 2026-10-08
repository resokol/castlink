"use client";
import { type ReserveView } from "@/lib/client-reserve";
import { reserveStatusText } from "@/lib/use-session-transfer";
import type { TransferTarget } from "./ServerTransferPanel";

export function EmergencyReservePanel({ view, targets, onSelect, onActivate }: {
  view: ReserveView; targets: TransferTarget[]; onSelect: (targetId: string) => void; onActivate: () => void;
}) {
  const age = view.prepared ? Math.max(0, Math.floor((Date.now() - view.prepared.snapshotAt) / 1000)) : undefined;
  return <section className="transfer-compact" aria-label="Аварийный резерв">
    <div><p className="eyebrow">АВАРИЙНЫЙ РЕЗЕРВ</p><strong>{view.prepared?.label || "Резерв не выбран"}</strong><p className="muted">Выберите один резерв заранее. При отказе основного сервера перенесите подготовленных участников кнопкой.</p></div>
    <div className="transfer-server-list">
      <label>Выбранный резерв<select aria-label="Аварийный сервер" value={view.prepared?.targetId || ""} disabled={view.busy || view.sourceUnavailable} onChange={event => onSelect(event.target.value)}>
        <option value="">Без аварийного резерва</option>
        {view.prepared && !targets.some(target => target.id === view.prepared!.targetId) && <option value={view.prepared.targetId}>{view.prepared.label}</option>}
        {targets.map(target => <option key={target.id} value={target.id} disabled={!target.available}>{target.label}</option>)}
      </select></label>
      <p role="status">{reserveStatusText(view)}</p>
      {age !== undefined && <small className="muted">Подтверждённый снимок: {age} сек. назад. Готовность до {new Date(view.prepared!.readyUntil).toLocaleTimeString()}.</small>}
      <button type="button" className="button-primary" disabled={view.busy || !view.prepared || view.prepared.readyUntil <= Date.now() || view.phase === "committed"} onClick={onActivate}>{view.busy ? "Подготовка переноса…" : "Перенести на аварийный резерв"}</button>
      {view.error && <p className="transfer-server-error" role="alert">{view.error}</p>}
    </div>
  </section>;
}
