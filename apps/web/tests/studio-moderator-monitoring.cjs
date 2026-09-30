const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../app/studio/page.tsx"), "utf8");
const panel = fs.readFileSync(path.resolve(__dirname, "../components/ModeratorStudioMonitoring.tsx"), "utf8");

for (const snippet of [
  "ModeratorStudioMonitoring",
  "value={mainStudioMonitor}",
  'onChange={patch => monitoring.change("studio-panel-main", patch)}',
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "studio-moderator-listen",
  "Слушать студию",
  "Видео основной студии только у меня",
  "Личная громкость Studio Return",
  "onChange({ audio: !value.audio })",
  "onChange({ video: !value.video })",
  "onChange({ volume: Number(event.target.value) })",
]) assert.ok(panel.includes(snippet), `missing moderator control: ${snippet}`);

assert.doesNotMatch(page, /className="studio-moderator-listen"/);

console.log("PASS: moderator Studio monitoring extraction preserves personal monitoring callbacks");
