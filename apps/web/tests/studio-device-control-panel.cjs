const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const panel = fs.readFileSync(path.resolve(__dirname, "../components/StudioDeviceControlPanel.tsx"), "utf8");

for (const snippet of [
  "StudioDeviceControlPanel",
  "role={studioRole}",
  "room={room}",
  "cameraId={returnVideoDevice}",
  "microphoneId={returnAudioDevice}",
  "headphonesId={returnOutputDevice}",
  "remoteDesired={remoteDesired}",
  "remoteOnline={studioPrimaryOnline}",
  "onRemoteChange={patch => { void persistControlPatch(patch).catch(() => undefined); }}",
]) assert.ok(page.includes(snippet), `missing page wiring: ${snippet}`);

for (const snippet of [
  "MediaDevicePicker",
  "RemoteStudioDevices",
  'role === "primary"',
  "onDevicesChanged={onDevicesChanged}",
  "onOutputStatus={onOutputStatus}",
  "onRemoteChange",
]) assert.ok(panel.includes(snippet), `missing device panel behavior: ${snippet}`);

assert.doesNotMatch(page, /<MediaDevicePicker/);
assert.doesNotMatch(page, /<RemoteStudioDevices/);

const ts = require("typescript");
const syntax = ts.createSourceFile("StudioWorkspace.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const elements = [], deviceMounts = [];
(function visit(node) {
  if (ts.isJsxElement(node)) elements.push(node);
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(syntax) === "StudioDeviceControlPanel") deviceMounts.push(node);
  ts.forEachChild(node, visit);
})(syntax);
const hasClass = (node, value) => node.openingElement.attributes.properties.some(attribute => attribute.name?.getText(syntax) === "className" && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text.split(/\s+/).includes(value));
const hero = elements.find(node => hasClass(node, "studio-return-hero"));
const devices = elements.find(node => hasClass(node, "studio-device-settings"));
assert.ok(devices, "studio devices occupy the shared monitor layout");
assert.equal(devices.parent, hero, "devices and the outgoing rail share the same permanent grid");
const heroChildren = hero.children.filter(ts.isJsxElement);
assert.equal(heroChildren.indexOf(devices), heroChildren.findIndex(node => hasClass(node, "studio-return-preview-card")) + 1, "devices follow the preview and viewer count directly");
assert.equal(deviceMounts.length, 1, "there is one device-control owner across tab changes");
let ancestor = deviceMounts[0];
while (ancestor && ancestor !== devices) { assert.ok(!ts.isJsxExpression(ancestor), "tab changes hide the device controls without conditionally unmounting them"); ancestor = ancestor.parent; }
assert.equal(ancestor, devices);
assert.equal(elements.filter(node => hasClass(node, "return-panel")).length, 0, "the duplicate lower Studio Return controls are removed");

console.log("PASS: Studio device control extraction preserves local/remote device wiring");
