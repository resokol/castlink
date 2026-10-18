"use client";
import { AdminInviteButton } from "./AdminInviteButton";
import { ModeratorInviteButton } from "./ModeratorInviteButton";
import { SavedGuestEntrySettings } from "./GuestEntrySettings";
import { useI18n } from "@/components/I18nProvider";

import type { FormEvent } from "react";

export function RoomManagementPanel({
  hidden,
  studioId = "studio-default",
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
  studioId?: string;
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
  const { t } = useI18n();
  return <>
    <div id="studio-room-management-panel" className="studio-room-management" hidden={hidden}>
      <div className="section-heading">
        <div><p className="eyebrow">{t("УПРАВЛЕНИЕ КОМНАТОЙ")}</p><h2>{t("Настройки комнаты")}</h2></div>
        <span>{t("Комнат:")} {rooms.length}</span>
      </div>
      <div className="panel studio-room-controls">
        <select value={roomName} onChange={event => onSwitchRoom(event.target.value)} aria-label={t("Активная комната")}>
          {rooms.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        {!simpleRoom && <><input
          value={newRoomName}
          onChange={event => onNewRoomNameChange(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") onCreateRoom(); }}
          placeholder={t("Название новой комнаты")}
          aria-label={t("Название новой комнаты")}
          style={{ minWidth: 220 }}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={newRoomPassword}
          onChange={event => onNewRoomPasswordChange(event.target.value)}
          placeholder={t("Пароль гостей (необязательно)")}
          aria-label={t("Пароль новой комнаты")}
          maxLength={256}
        />
        <button type="button" disabled={!newRoomName.trim() || roomBusy} onClick={onCreateRoom}>{t("+ Создать комнату")}</button></>}
        <a className="button-link" href={entryPath} target="_blank" rel="noopener noreferrer">{simpleRoom ? t("Создать ещё одну комнату") : t("Открыть ещё одну студию")}</a>
        <button type="button" onClick={onOpenEditor}>{t("✎ Изменить")}</button>
        <button type="button" onClick={onDeleteRoom}>{t("Удалить комнату")}</button>
        <div className="studio-room-customization stack"><AdminInviteButton roomName={roomName} studioId={studioId} /><ModeratorInviteButton roomName={roomName} studioId={studioId} scope="room" /></div>
        <div className="studio-room-customization"><SavedGuestEntrySettings roomName={roomName} studioId={studioId} /></div>
      </div>
    </div>
    {editOpen && <div className="room-edit-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCloseEditor(); }}>
      <form className="panel stack room-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="room-edit-title" onSubmit={onSaveSettings}>
        <h2 id="room-edit-title">{t("Настройки комнаты")}</h2>
        <label>{t("Название комнаты")}<input required maxLength={100} value={editRoomName} onChange={event => onEditRoomNameChange(event.target.value)} /></label>
        {simpleRoom && <small className="muted">{t("Для переименования отключите эфир и предпросмотр. В комнате не должно быть гостей или другого персонала.")}</small>}
        <div className="room-password-status">
          <strong>{t("Пароль гостей:")} {roomPasswordSet ? t("задан") : t("не задан")}</strong>
          <small>{roomPasswordSet && !currentRoomPassword ? t("Старый пароль был сохранён до обновления и восстановить его нельзя. Задайте новый, чтобы студия могла его показывать.") : t("Здесь отображается пароль гостей. Поле можно изменить, чтобы задать новый пароль.")}</small>
        </div>
        <label>{t("Пароль гостей")}<div className="password-field">
          <input type={showEditRoomPassword ? "text" : "password"} autoComplete="new-password" maxLength={256} value={editRoomPassword} onChange={event => onEditRoomPasswordChange(event.target.value)} placeholder={roomPasswordSet ? t("Пароль комнаты") : t("Задайте пароль (необязательно)")} />
          <button className="button-secondary" type="button" aria-pressed={showEditRoomPassword} onClick={onTogglePasswordVisibility}>{showEditRoomPassword ? t("Скрыть") : t("Показать")}</button>
        </div></label>
        {roomPasswordSet && <label className="remove-room-password"><input type="checkbox" checked={removeRoomPassword} onChange={event => onRemovePasswordChange(event.target.checked)} /> {t("Убрать пароль — гости смогут входить без него")}</label>}
        <p className="muted">{t("После смены или снятия пароля ранее выданные доступы и приглашения для этой комнаты перестанут работать.")}</p>
        <div className="room-edit-actions">
          <button type="button" className="button-secondary" onClick={onCloseEditor}>{t("Отмена")}</button>
          <button className="button-primary" disabled={roomBusy || !editRoomName.trim()}>{roomBusy ? t("Сохранение…") : t("Сохранить")}</button>
        </div>
      </form>
    </div>}
  </>;
}
