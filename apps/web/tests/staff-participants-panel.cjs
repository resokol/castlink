const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const panel = fs.readFileSync(path.resolve(__dirname, "../components/StaffParticipantsPanel.tsx"), "utf8");

for (const snippet of [
  "StaffParticipantsPanel",
  "participants={staffParticipants.map(participant => ({",
  "preview: participant.self ? undefined : <GuestPreview",
  "preference={monitoring.preferences[participant.identity]}",
  "onChange={patch => monitoring.change(participant.identity, patch)}",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "Администраторы и модераторы",
  "studio-staff-list",
  "studio-staff-row",
  "studio-staff-name",
  'participant.role === "admin" ? "Администратор" : "Модератор"',
  "Администраторы и модераторы пока не подключены.",
]) assert.ok(panel.includes(snippet), `missing staff panel behavior: ${snippet}`);

assert.doesNotMatch(page, /className="panel studio-staff-panel"/);

console.log("PASS: staff participants extraction preserves roles, self marker and preview slot");
