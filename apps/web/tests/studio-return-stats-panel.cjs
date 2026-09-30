const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../app/studio/page.tsx"), "utf8");
const panel = fs.readFileSync(path.resolve(__dirname, "../components/StudioReturnStatsPanel.tsx"), "utf8");

for (const snippet of [
  "StudioReturnStatsPanel",
  "role={studioRole}",
  "statusText={outboundStatusText}",
  "hasSample={Boolean(outboundView.sample)}",
  "stats={displayedOutbound}",
  "bitratePoints={returnBitratePoints}",
  "historyLength={displayedHistory.length}",
  "fps={returnFps}",
  "bitrate={returnBitrate}",
  "onQualityChange={(fps, bitrate) => void changeQuality(fps, bitrate)}",
  "headerActions={<div className=\"studio-quick-controls\"",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "Исходящий поток студии",
  "return-stat-grid",
  "bitrate-chart",
  "Частота кадров студии",
  "Общий лимит видеобитрейта",
  "studioControlError",
  "controlPollError",
  "controlHeartbeatError",
  "headerActions",
]) assert.ok(panel.includes(snippet), `missing stats panel behavior: ${snippet}`);

assert.doesNotMatch(page, /<div className="panel return-stats">/);

console.log("PASS: Studio Return stats extraction preserves quality controls, errors and header actions");
