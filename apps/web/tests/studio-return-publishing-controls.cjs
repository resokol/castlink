const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const controls = fs.readFileSync(path.resolve(__dirname, "../components/StudioReturnPublishingControls.tsx"), "utf8");

for (const snippet of [
  "StudioReturnPublishingControls",
  "studioOnly={studioOnly}",
  "modeBusy={modeBusy}",
  "role={studioRole}",
  "hasSession={Boolean(sessionToken)}",
  "screenShare={<ScreenShareButton room={room} compact outputMuted={outputMuted} getOutputMuted={() => outputMutedRef.current} />}",
  "onTogglePreview={() => changePreview(!returnActive)}",
  "onToggleOnAir={() => requestOnAir(!onAir)}",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "Гости могут видеть только студию",
  "Проверить Studio Return",
  "Остановить проверку",
  "Начать эфир",
  "Завершить эфир",
  'aria-pressed={onAir}',
  'onAir ? "air-toggle-live" : ""',
  'role === "connecting"',
  "!returnActive || !previewReady",
]) assert.ok(controls.includes(snippet), `missing publishing control behavior: ${snippet}`);

assert.doesNotMatch(page, /className="studio-quick-controls"/);

console.log("PASS: Studio Return publishing extraction preserves enable/disable rules and callbacks");
