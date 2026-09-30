const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../app/studio/page.tsx"), "utf8");
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

console.log("PASS: Studio device control extraction preserves local/remote device wiring");
