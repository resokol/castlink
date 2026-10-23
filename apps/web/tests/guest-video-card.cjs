const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const card = fs.readFileSync(path.resolve(__dirname, "../components/GuestVideoCard.tsx"), "utf8");

for (const snippet of [
  "GuestVideoCard",
  "guest={g}",
  "roomName={roomName}",
  "outputUrl={outputUrl(g.identity)}",
  "copied={copied === g.identity}",
  "receiveBitrate={receiveFor(g.identity)}",
  "preference={monitoring.preferences[g.identity]}",
  "onQualityChange={bitrateKbps => applyReceiveQuality(g.identity, bitrateKbps)}",
  "onMonitoringChange={patch => monitoring.change(g.identity, patch)}",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "guest-card-heading",
  "guest-preview-actions",
  "guest-card-bitrate",
  "guest-card-meter",
  "guest-card-details",
  "MonitoringControls",
  "Битрейт участника",
  "Скопировано",
]) assert.ok(card.includes(snippet), `missing card behavior: ${snippet}`);

const ts = require("typescript");
const parsed = ts.createSourceFile("StudioWorkspace.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let guestRender;
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(parsed) === "StudioGuestMediaPanel") guestRender = node;
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(guestRender, "actual guest collection renders extracted GuestVideoCard");
assert.doesNotMatch(guestRender.getText(parsed), /className="guest-card-heading"/);
assert.doesNotMatch(guestRender.getText(parsed), /className="guest-card-details"/);

console.log("PASS: guest video card extraction preserves preview, monitoring, quality and actions");

assert.doesNotMatch(card, /RotateVideoButton/, "duplicate 90-degree rotation is removed; image controls own rotation");
