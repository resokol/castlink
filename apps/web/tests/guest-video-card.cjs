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

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');
const { GuestVideoCard } = load('../components/GuestVideoCard.tsx');
const props = {
  guest: { identity: 'guest-freshness', name: 'Freshness', camera: true, microphone: true, resolution: '1920×1080', bitrateKbps: 4000,
    packetLoss: 0, currentLoss: { packets: 0, percent: 0 }, totalLoss: { packets: 3000, percent: .03 }, rttMs: 25, jitterMs: 2,
    stability: 'Хорошая', networkMeasured: true, statsSampledAtRef: { current: Date.now() }, networkSampledAtRef: { current: Date.now() - 7000 } },
  roomName: 'qa', outputUrl: '#', copied: false, receiveBitrate: 4000, preference: { audio: true, video: true, volume: 75 },
  preview: React.createElement('video'), meter: null, onCopy() {}, onQualityChange() {}, onMonitoringChange() {},
};
const html = renderToStaticMarkup(React.createElement(GuestVideoCard, props));
assert.match(html, /data-quality="unknown"/, 'stale mini status is unknown even when audio is fresh');
assert.match(html, /net-unknown/, 'expanded network grade also expires after six seconds');
assert.doesNotMatch(html, /net-good|25 \/ 2|0% \/ 0 пак/, 'expanded current measurements do not present stale data');
assert.match(html, /0,03% \/ 3\u00a0000 пак/, 'historical losses survive current measurement expiry');
console.log('PASS: real card mini and expanded network status expire together while session history remains');
