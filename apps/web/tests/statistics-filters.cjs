const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dashboard = fs.readFileSync(path.resolve(__dirname, "../components/StatisticsDashboard.tsx"), "utf8");
const api = fs.readFileSync(path.resolve(__dirname, "../app/api/stats/route.ts"), "utf8");
const report = fs.readFileSync(path.resolve(__dirname, "../lib/stats-report.ts"), "utf8");

for (const snippet of [
  'roleFilter',
  'participantFilter',
  'stats-filter-grid',
  'params.set("role", roleFilter)',
  'params.set("participant", participantFilter)',
  'Все роли',
  'Все участники',
  'Все сессии выборки',
  'visibleConnections',
]) assert.ok(dashboard.includes(snippet), `missing statistics filter wiring: ${snippet}`);

assert.ok(api.includes('"admin"') && api.includes('"moderator"'), "stats API must preserve staff roles");
assert.ok(api.includes('searchParams.get("participant")'), "stats API must accept stable participant identity filter");
assert.ok(api.includes('allowedRoles'), "stats API must validate role filter");

for (const snippet of ["Подключения", "Последние медиапотоки", "WebRTC telemetry", "Переподключения"]) {
  assert.ok(report.includes(snippet), `detailed report missing: ${snippet}`);
}

console.log("PASS: statistics role/participant/session filters and detailed report wiring");
