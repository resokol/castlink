"use client";

export type GuestParticipantRow = {
  identity: string;
  name: string;
  moveTarget: string;
  outputUrl: string;
  copied: boolean;
};

export function GuestParticipantsTable({
  guests,
  rooms,
  roomName,
  onMoveTargetChange,
  onMove,
  onKick,
  onRefresh,
  onCopy,
}: {
  guests: GuestParticipantRow[];
  rooms: string[];
  roomName: string;
  onMoveTargetChange: (identity: string, targetRoom: string) => void;
  onMove: (identity: string, targetRoom: string) => void;
  onKick: (identity: string, name: string) => void;
  onRefresh: (identity: string) => void;
  onCopy: (identity: string, outputUrl: string) => void;
}) {
  return <div className="panel studio-guests-panel">
    <h2>Гости</h2>
    <p className="muted">Мониторинг гостей меняется только в этой студии. Громкость и выключение видео не влияют на эфир, других гостей и выходы vMix.</p>
    {guests.length === 0 ? <p className="muted">Подключённых гостей пока нет.</p> : (
      <div className="guest-table-wrap">
        <table className="guest-table">
          <thead><tr><th>Гость</th><th>vMix</th></tr></thead>
          <tbody>{guests.map(guest => (
            <tr key={guest.identity}>
              <td>
                <strong>{guest.name}</strong>{" "}
                <span className="studio-participant-role studio-participant-role-guest">Гость</span>
                <small>{guest.identity}</small>
                <div className="studio-guest-actions">
                  <select value={guest.moveTarget} onChange={event => onMoveTargetChange(guest.identity, event.target.value)}>
                    <option value="">Перевести в комнату…</option>
                    {rooms.filter(name => name !== roomName).map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <button disabled={!guest.moveTarget} onClick={() => onMove(guest.identity, guest.moveTarget)}>Перевести</button>
                  <button onClick={() => onKick(guest.identity, guest.name)}>Отключить гостя</button>
                  <button onClick={() => onRefresh(guest.identity)}>↻ Обновить</button>
                </div>
              </td>
              <td className="actions">
                <a className="button-link" href={guest.outputUrl} target="_blank" rel="noreferrer">Открыть</a>
                <button onClick={() => onCopy(guest.identity, guest.outputUrl)}>{guest.copied ? "Скопировано" : "Копировать URL"}</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )}
  </div>;
}
