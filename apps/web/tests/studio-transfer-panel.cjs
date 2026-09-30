const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../app/studio/page.tsx"), "utf8");
const panel = fs.readFileSync(path.resolve(__dirname, "../components/ServerTransferPanel.tsx"), "utf8");

assert.match(page, /ServerTransferPanel/);
assert.match(page, /info={transferInfo}/);
assert.match(page, /targetId={transferTargetId}/);
assert.match(page, /busy={transferBusy}/);
assert.match(page, /error={transferError}/);
assert.match(page, /onStart={() => void startServerTransfer()}/);
assert.match(page, /onRefresh={() => setTransferRefresh(v => v + 1)}/);

assert.match(panel, /ПЕРЕНОС КОМНАТЫ/);
assert.match(panel, /Загружаем серверы/);
assert.match(panel, /Другие серверы не настроены/);
assert.match(panel, /disabled={!targetId || busy || info.loading}/);
assert.match(panel, /target.available ? "Готов" : "Недоступен"/);
assert.match(panel, /onTargetChange(event.target.value)/);

console.log("PASS: Studio server transfer panel extraction preserves state and callbacks");
