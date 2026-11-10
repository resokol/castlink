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
const rail = elements.find(node => hasClass(node, "studio-return-rail"));
const devices = elements.find(node => hasClass(node, "studio-device-settings"));
const transport = elements.find(node => hasClass(node, "studio-transport-bar"));
assert.ok(devices, "studio device controls are mounted in the settings disclosure");
const controls = elements.find(node => hasClass(node, "studio-playback-controls"));
const groupedPreview = elements.find(node => hasClass(node, "studio-return-preview-card"));
const devicePopover=devices.parent;
assert.ok(ts.isJsxElement(devicePopover)&&devicePopover.openingElement.tagName.getText(syntax)==="StudioConsolePopover", "device settings have one native disclosure owner");
assert.ok(devicePopover.parent===controls, "device disclosure stays in the program group");
assert.ok(controls.parent === groupedPreview, "playback controls stay inside the monitor card");
assert.ok(transport.parent === controls, "settings trigger and device disclosure share one controls column");
assert.ok(!controls.getText(syntax).includes("<StudioReturnStatsPanel"), "outbound statistics remain in their adjacent rail");
assert.ok(rail.getText(syntax).includes("<StudioReturnStatsPanel"), "the statistics rail retains the outgoing panel");
assert.ok(transport.getText(syntax).includes('settingsTarget="studio-settings"'), "publishing action points to its native disclosure");
assert.ok(transport.getText(syntax).includes("settingsOpen={studioSettingsOpen}"), "the settings action exposes disclosure state");
assert.ok(!devices.getText(syntax).includes('hidden={!studioSettingsOpen}'), "native disclosure owns visibility without conditionally mounting devices");
const invite = elements.find(node => hasClass(node, "studio-invite-compact"));
const preview = elements.find(node => hasClass(node, "studio-return-preview-card"));
const layout = elements.find(node => hasClass(node, "studio-return-layout"));
const sources = elements.find(node => hasClass(node, "studio-sources-section"));
const returnSection = elements.find(node => hasClass(node, "studio-return-section"));
assert.ok(ts.isJsxElement(invite.parent)&&invite.parent.openingElement.tagName.getText(syntax)==="StudioConsolePopover", "invite controls stay mounted in their owned native disclosure");
assert.ok(sources.parent===layout, "guest cards share a stable layout with invites and outbound stats");
assert.ok(returnSection.parent===layout, "the Studio Return section stays mounted in the shared layout");
assert.equal(deviceMounts.length, 1, "there is one device-control owner across tab changes");
let ancestor = deviceMounts[0];
while (ancestor && ancestor !== devices) { assert.ok(!ts.isJsxExpression(ancestor), "settings toggles hide the device controls without conditionally unmounting them"); ancestor = ancestor.parent; }
assert.equal(ancestor, devices);
assert.equal(elements.filter(node => hasClass(node, "return-panel")).length, 0, "the duplicate lower Studio Return controls are removed");

console.log("PASS: Studio device control extraction preserves local/remote device wiring");
