"use client";

import type { FormEvent } from "react";

export function RoomManagementPanel({
  hidden,
  simpleRoom = false,
  entryPath = "/studio",
  rooms,
  roomName,
  newRoomName,
  newRoomPassword,
  roomBusy,
  editOpen,
  editRoomName,
  editRoomPassword,
  currentRoomPassword,
  roomPasswordSet,
  showEditRoomPassword,
  removeRoomPassword,
  onSwitchRoom,
  onNewRoomNameChange,
  onNewRoomPasswordChange,
  onCreateRoom,
  onOpenEditor,
  onDeleteRoom,
  onCloseEditor,
  onEditRoomNameChange,
  onEditRoomPasswordChange,
  onTogglePasswordVisibility,
  onRemovePasswordChange,
  onSaveSettings,
}: {
  hidden: boolean;
  simpleRoom?: boolean;
  entryPath?: string;
  rooms: string[];
  roomName: string;
  newRoomName: string;
  newRoomPassword: string;
  roomBusy: boolean;
  editOpen: boolean;
  editRoomName: string;
  editRoomPassword: string;
  currentRoomPassword: string;
  roomPasswordSet: boolean;
  showEditRoomPassword: boolean;
  removeRoomPassword: boolean;
  onSwitchRoom: (room: string) => void;
  onNewRoomNameChange: (value: string) => void;
  onNewRoomPasswordChange: (value: string) => void;
  onCreateRoom: () => void;
  onOpenEditor: () => void;
  onDeleteRoom: () => void;
  onCloseEditor: () => void;
  onEditRoomNameChange: (value: string) => void;
  onEditRoomPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onRemovePasswordChange: (value: boolean) => void;
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <>
    <div id="studio-room-management-panel" className="studio-room-management" hidden={hidden}>
      <div className="section-heading">
        <div><p className="eyebrow">УПРАВЛЕНИЕ КОМНАТОЙ</p><h2>Настройки комнаты</h2></div>
        <span>Комнат: {rooms.length}</span>
      </div>
      <div className="panel studio-room-controls">
        <select value={roomName} onChange={event => onSwitchRoom(event.target.value)} aria-label="Активная комната">
          {rooms.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        {!simpleRoom && <><input
          value={newRoomName}
          onChange={event => onNewRoomNameChange(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") onCreateRoom(); }}
          placeholder="Название новой комнаты"
          aria-label="Название новой комнаты"
          style={{ minWidth: 220 }}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={newRoomPassword}
          onChange={event => onNewRoomPasswordChange(event.target.value)}
          placeholder="Пароль гостей (необязательно)"
          aria-label="Пароль новой комнаты"
          maxLength={256}
        />
        <button type="button" disabled={!newRoomName.trim() || roomBusy} onClick={onCreateRoom}>+ Создать комнату</button></>}
        <a className="button-link" href={entryPath} target="_blank" rel="noopener noreferrer">{simpleRoom ? "Создать ещё одну комнату" : "Открыть ещё одну студию"}</a>
        <button type="button" onClick={onOpenEditor}>✎ Изменить</button>
        <button type="button" onClick={onDeleteRoom}>Удалить комнату</button>
      </div>
    </div>

    {editOpen && <div className="room-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCloseEditor(); }}>
      <form className="panel stack room-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="room-edit-title" onSubmit={onSaveSettings}>
        <h2 id="room-edit-title">Настройки комнаты</h2>
        <label>Название комнаты<input required maxLength={100} value={editRoomName} onChange={event => onEditRoomNameChange(event.target.value)} /></label>
        {simpleRoom && <small className="muted">Для переименования отключите эфир и предпросмотр. В комнате не должно быть гостей или другого персонала.</small>}
        <div className="room-password-status">
          <strong>Пароль гостей: {roomPasswordSet ? "задан" : "не задан"}</strong>
          <small>{roomPasswordSet && !currentRoomPassword ? "Старый пароль был сохранён до обновления и восстановить его нельзя. Задайте новый, чтобы студия могла его показывать." : "Здесь отображается пароль гостей. Поле можно изменить, чтобы задать новый пароль."}</small>
        </div>
        <label>Пароль гостей<div className="password-field">
          <input type={showEditRoomPassword ? "text" : "password"} autoComplete="new-password" maxLength={256} value={editRoomPassword} onChange={event => onEditRoomPasswordChange(event.target.value)} placeholder={roomPasswordSet ? "Пароль комнаты" : "Задайте пароль (необязательно)"} />
          <button className="button-secondary" type="button" aria-pressed={showEditRoomPassword} onClick={onTogglePasswordVisibility}>{showEditRoomPassword ? "Скрыть" : "Показать"}</button>
        </div></label>
        {roomPasswordSet && <label className="remove-room-password"><input type="checkbox" checked={removeRoomPassword} onChange={event => onRemovePasswordChange(event.target.checked)} /> Убрать пароль — гости смогут входить без него</label>}
        <p className="muted">После смены или снятия пароля ранее выданные доступы и приглашения для этой комнаты перестанут работать.</p>
        <div className="room-edit-actions">
          <button type="button" className="button-secondary" onClick={onCloseEditor}>Отмена</button>
          <button className="button-primary" disabled={roomBusy || !editRoomName.trim()}>{roomBusy ? "Сохранение…" : "Сохранить"}</button>
        </div>
      </form>
    </div>}
  </>;
}
