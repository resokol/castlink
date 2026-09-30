const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../app/studio/page.tsx"), "utf8");
const table = fs.readFileSync(path.resolve(__dirname, "../components/GuestParticipantsTable.tsx"), "utf8");

for (const snippet of [
  "GuestParticipantsTable",
  "moveTarget: moveTargets[guest.identity] || \"\"",
  "outputUrl: outputUrl(guest.identity)",
  "copied: copied === guest.identity",
  "onMoveTargetChange={(identity, targetRoom) => setMoveTargets",
  "onMove={(identity, targetRoom) => void moveGuest(identity, targetRoom)}",
  "onKick={(identity, name) => void kick(identity, name)}",
  "onRefresh={identity => void refreshGuest(identity)}",
  "onCopy={(identity, url) => void copyGuestOutput(identity, url)}",
  "const moveGuest = async",
  "const refreshGuest = async",
  "const copyGuestOutput = async",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "studio-guests-panel",
  "guest-table-wrap",
  "Перевести в комнату…",
  "Отключить гостя",
  "↻ Обновить",
  "Копировать URL",
  "onMoveTargetChange(guest.identity, event.target.value)",
]) assert.ok(table.includes(snippet), `missing guest table behavior: ${snippet}`);

assert.doesNotMatch(page, /className="panel studio-guests-panel"/);

console.log("PASS: guest participants table extraction preserves move, kick, refresh and output actions");
