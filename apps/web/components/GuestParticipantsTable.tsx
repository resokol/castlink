"use client";
import { useI18n } from "@/components/I18nProvider";


export type GuestParticipantRow = {
  identity: string;
  name: string;
  moveTarget: string;
  outputUrl: string;
  copied: boolean;
};

export function GuestParticipantsTable({
  canMove = true,
  guests,
  rooms,
  roomName,
  onMoveTargetChange,
  onMove,
  onKick,
  onRefresh,
  onCopy,
}: {
  canMove?: boolean;
  guests: GuestParticipantRow[];
  rooms: string[];
  roomName: string;
  onMoveTargetChange: (identity: string, targetRoom: string) => void;
  onMove: (identity: string, targetRoom: string) => void;
  onKick: (identity: string, name: string) => void;
  onRefresh: (identity: string) => void;
  onCopy: (identity: string, outputUrl: string) => void;
}) {
  const { t, locale } = useI18n();
  return <div className="panel studio-guests-panel">
    <h2>{t("Гости")}</h2>
    <p className="muted">{t("Мониторинг гостей меняется только в этой студии. Громкость и выключение видео не влияют на эфир, других гостей и выходы vMix.")}</p>
    {guests.length === 0 ? <p className="muted">{t("Подключённых гостей пока нет.")}</p> : (
      <div className="guest-table-wrap">
        <table className="guest-table">
          <thead><tr><th>{t("Гость")}</th><th>vMix</th></tr></thead>
          <tbody>{guests.map(guest => (
            <tr key={guest.identity}>
              <td>
                <strong>{guest.name}</strong>{" "}
                <span className="studio-participant-role studio-participant-role-guest">{t("Гость")}</span>
                <small>{guest.identity}</small>
                <div className="studio-guest-actions">
                  {canMove && <><select value={guest.moveTarget} onChange={event => onMoveTargetChange(guest.identity, event.target.value)}>
                    <option value="">{t("Перевести в комнату…")}</option>
                    {rooms.filter(name => name !== roomName).map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <button disabled={!guest.moveTarget} onClick={() => onMove(guest.identity, guest.moveTarget)}>{t("Перевести")}</button></>}
                  <button onClick={() => onKick(guest.identity, guest.name)}>{t("Отключить гостя")}</button>
                  <button onClick={() => onRefresh(guest.identity)}>{t("↻ Обновить")}</button>
                </div>
              </td>
              <td className="actions">
                <a className="button-link" href={guest.outputUrl} target="_blank" rel="noreferrer">{t("Открыть")}</a>
                <button onClick={() => onCopy(guest.identity, guest.outputUrl)}>{guest.copied ? t("Скопировано") : t("Копировать URL")}</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </div>;
}
