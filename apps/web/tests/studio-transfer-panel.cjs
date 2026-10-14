const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const panel = fs.readFileSync(path.resolve(__dirname, "../components/ServerTransferPanel.tsx"), "utf8");

assert.match(page, /ServerTransferPanel/);
assert.ok(page.includes("info={transferInfo}"));
assert.ok(page.includes("targetId={transferTargetId}"));
assert.ok(page.includes("busy={transferBusy}"));
assert.ok(page.includes("error={transferError}"));
assert.ok(page.includes("onStart={() => void startServerTransfer()}"));
assert.ok(page.includes("onRefresh={() => setTransferRefresh(v => v + 1)}"));

assert.match(panel, /ПЕРЕНОС КОМНАТЫ/);
assert.match(panel, /Загружаем серверы/);
assert.match(panel, /Другие серверы не настроены/);
assert.ok(panel.includes("disabled={!targetId || busy || info.loading}"));
assert.ok(panel.includes('target.available ? t("Доступен") : t("Недоступен")'));
assert.ok(panel.includes("onTargetChange(event.target.value)"));

console.log("PASS: Studio server transfer panel extraction preserves state and callbacks");
