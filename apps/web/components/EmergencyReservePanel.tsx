"use client";
import { type ReserveView } from "@/lib/client-reserve";
import { reserveStatusText, reserveAutomaticStatusText } from "@/lib/use-session-transfer";
import type { TransferTarget } from "./ServerTransferPanel";

export function EmergencyReservePanel({ view, targets, onSelect, onActivate, onAutomatic }: {
  view: ReserveView; targets: TransferTarget[]; onSelect: (targetId: string) => void; onActivate: () => void; onAutomatic: (enabled: boolean) => void;
}) {
  return <section className="transfer-compact" aria-label="Аварийный резерв">
    <div><p className="eyebrow">АВАРИЙНЫЙ РЕЗЕРВ</p><strong>{view.prepared?.label || "Резерв не выбран"}</strong><p className="muted">Выберите один резерв заранее. Переносите участников кнопкой или включите автоматический перенос при подтверждённом отказе.</p></div>
    <div className="transfer-server-list">
      <label>Выбранный резерв<select aria-label="Аварийный сервер" value={view.prepared?.targetId || ""} disabled={view.busy || view.sourceUnavailable} onChange={event => onSelect(event.target.value)}>
        <option value="">Без аварийного резерва</option>
        {view.prepared && !targets.some(target => target.id === view.prepared!.targetId) && <option value={view.prepared.targetId}>{view.prepared.label}</option>}
        {targets.map(target => <option key={target.id} value={target.id} disabled={!target.available}>{target.label}</option>)}
      </select></label>
      <p role="status">{reserveStatusText(view)}</p>
      <label><input type="checkbox" aria-label="Автоматический аварийный перенос" checked={view.autoPending ?? view.prepared?.autoEnabled === true} disabled={!view.prepared || view.prepared.autoSupported !== true || view.autoUpdating || !["ready", "unreachable"].includes(view.phase)} onChange={event => onAutomatic(event.target.checked)} /> Автоматический аварийный перенос</label>
      <p role="status">{reserveAutomaticStatusText(view)}</p>
      {view.autoUnconfirmed && <button type="button" disabled={view.autoUpdating || view.phase === "committed"} onClick={() => onAutomatic(view.autoPending === true)}>Повторить {view.autoPending ? "включение" : "выключение"} автоматики</button>}
      <p className="muted">Работает при открытой активной вкладке основной студии и действующей подготовке до 5 минут. Закрытая или приостановленная вкладка, истёкшая готовность либо недоступный резерв не обеспечивают перенос. Медиа прервётся на время подключения; возврат — вручную.</p>
      <button type="button" className="button-primary" disabled={view.busy || !view.prepared || !["ready", "unreachable"].includes(view.phase)} onClick={onActivate}>{view.busy ? "Подготовка переноса…" : "Перенести на аварийный резерв"}</button>
      {view.error && <p className="transfer-server-error" role="alert">{view.error}</p>}
    </div>
  </section>;
}
