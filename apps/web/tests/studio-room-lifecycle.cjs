const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.resolve(__dirname, "../components/StudioWorkspace.tsx"), "utf8");
const lifecycle = fs.readFileSync(path.resolve(__dirname, "../lib/studio-room-lifecycle.ts"), "utf8");

for (const snippet of [
  "bindStudioRoomLifecycle",
  "const unbindRoomLifecycle = bindStudioRoomLifecycle(room, {",
  "onUpdate: update",
  "onActiveSpeakersChanged: updateMeterTargets",
  "onDataReceived: onData",
  "onDebugTracks: debugTracks",
  "unbindRoomLifecycle();",
]) assert.ok(page.includes(snippet), `missing lifecycle wiring: ${snippet}`);

for (const snippet of [
  "RoomEvent.ParticipantConnected",
  "RoomEvent.ParticipantDisconnected",
  "RoomEvent.TrackPublished",
  "RoomEvent.TrackUnpublished",
  "RoomEvent.TrackMuted",
  "RoomEvent.TrackUnmuted",
  "RoomEvent.ActiveSpeakersChanged",
  "RoomEvent.DataReceived",
  "RoomEvent.TrackSubscribed",
  "room.disconnect();",
]) assert.ok(lifecycle.includes(snippet), `missing lifecycle event: ${snippet}`);

assert.doesNotMatch(page, /room\.off\(RoomEvent\.ParticipantConnected/);
assert.doesNotMatch(page, /room\.off\(RoomEvent\.DataReceived/);

console.log("PASS: Studio Room lifecycle extraction preserves event binding and disconnect cleanup");
