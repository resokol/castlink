// Exercise the production action closure, including a reply after a room change.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const filename = path.join(__dirname, "../components/StudioWorkspace.tsx");
const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let action;
function walk(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "changeGuestMedia") action = node.initializer;
  ts.forEachChild(node, walk);
}
walk(source);
assert.ok(action, "production participant action exists");
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const responseExports = {};
vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, "../lib/control-response.ts"), "utf8")), { exports: responseExports, Error });
const room = { remoteParticipants: new Map([["guest-one", { camera: false, microphone: true }]]) };
const connectedStudioRoomRef = { current: room }, transferLeavingRef = { current: false }, guestMediaFlightsRef = { current: new WeakMap() };
let state = {}, calls = [], refreshes = 0;
const pending = [];
const run = vm.runInNewContext(compile(`(${action.getText(source)})`), {
  room, roomName: "room-a", studioId: "studio-a", connectedStudioRoomRef, transferLeavingRef, guestMediaFlightsRef,
  AbortSignal, JSON, Set, Error,
  setGuestMediaRequests: update => { state = update(state); },
  refreshRef: { current: async () => { refreshes++; } },
  readControlResponse: responseExports.readControlResponse,
  fetch: (url, init) => { calls.push({ url, init }); return new Promise((resolve, reject) => pending.push({ resolve, reject })); },
});
const reply = (status, data) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) });
(async () => {
  const first = run("guest-one", "audio", false);
  const duplicate = run("guest-one", "video", true);
  await duplicate;
  assert.equal(calls.length, 1, "same-identity duplicate is blocked synchronously, before a React render");
  assert.equal(state["guest-one"].busy, true);
  assert.equal(calls[0].url, "/api/participants");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { studioId: "studio-a", room: "room-a", identity: "guest-one", action: "media", kind: "audio", enabled: false });
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(room.remoteParticipants.get("guest-one").microphone, true, "pending request does not optimistically change actual media state");
  pending.shift().resolve(reply(200, { ok: true }));
  await first;
  assert.equal(state["guest-one"].busy, false);
  assert.equal(refreshes, 1);
  assert.equal(room.remoteParticipants.get("guest-one").microphone, true, "successful command still waits for actual publication state");

  const denied = run("guest-one", "video", true);
  assert.equal(JSON.parse(calls[1].init.body).enabled, true);
  pending.shift().resolve(reply(403, { error: "Permission denied" }));
  await denied;
  assert.equal(state["guest-one"].error, true);
  assert.equal(state["guest-one"].message, "Permission denied");
  assert.equal(refreshes, 1, "forbidden reply cannot report success");
  assert.equal(room.remoteParticipants.get("guest-one").camera, false);

  const network = run("guest-one", "audio", false);
  pending.shift().reject(new Error("Network lost"));
  await network;
  assert.equal(state["guest-one"].error, true);
  assert.equal(state["guest-one"].message, "Network lost");
  assert.equal(guestMediaFlightsRef.current.get(room).size, 0, "failures release the duplicate guard for an explicit retry");

  const stale = run("guest-one", "video", true);
  connectedStudioRoomRef.current = { remoteParticipants: new Map() };
  state = {}; // The real room-change effect clears feedback.
  pending.shift().resolve(reply(200, { ok: true }));
  await stale;
  assert.deepEqual(state, {}, "late reply cannot write feedback into the newly selected room");
  assert.equal(refreshes, 1, "late reply cannot refresh a different room");
  await run("guest-one", "video", true);
  assert.equal(calls.length, 4, "a disconnected/old room cannot send commands");
  connectedStudioRoomRef.current = room;
  transferLeavingRef.current = true;
  await run("guest-one", "video", true);
  assert.equal(calls.length, 4, "handoff prevents new commands");
  console.log("PASS studio participant quick actions: exact scoped payload, synchronous duplicate guard, real-state media, 403/network feedback, stale room and handoff safety");
})().catch(error => { console.error(error); process.exitCode = 1; });
