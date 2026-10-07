const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const panel = fs.readFileSync(path.resolve(__dirname, "../components/RoomManagementPanel.tsx"), "utf8");

assert.match(page, /RoomManagementPanel/);
for (const snippet of [
  "rooms={rooms}",
  "roomName={roomName}",
  "newRoomName={newRoomName}",
  "newRoomPassword={newRoomPassword}",
  "editOpen={activeTab === \"studio\" && roomEditOpen}",
  "onSwitchRoom={switchRoom}",
  "onCreateRoom={() => void createRoom()}",
  "onOpenEditor={openRoomEditor}",
  "onDeleteRoom={() => void deleteRoom()}",
  "onSaveSettings={saveRoomSettings}",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "УПРАВЛЕНИЕ КОМНАТОЙ",
  "Название новой комнаты",
  "Пароль гостей (необязательно)",
  "Удалить комнату",
  "Настройки комнаты",
  "Убрать пароль",
  "onSwitchRoom(event.target.value)",
  "onNewRoomNameChange(event.target.value)",
  "onSaveSettings",
]) assert.ok(panel.includes(snippet), `missing panel behavior: ${snippet}`);

assert.doesNotMatch(page, /id="studio-room-management-panel"/);
assert.doesNotMatch(page, /className="room-edit-backdrop"/);

console.log("PASS: Studio room management UI extraction preserves callbacks and dialog behavior");
