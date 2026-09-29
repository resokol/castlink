const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { initialRecoveryStatus, nextRecoveryStatus, recoveryBadge } = require("../lib/reconnect-status.ts");
let state = initialRecoveryStatus();
assert.equal(state.phase, "connecting");
state = nextRecoveryStatus(state, "connect-success");
assert.equal(state.phase, "connected");
state = nextRecoveryStatus(state, "reconnecting");
assert.equal(state.phase, "reconnecting");
assert.equal(recoveryBadge(state.phase), "Переподключение");
state = nextRecoveryStatus(state, "reconnected");
assert.equal(state.phase, "recovered");
assert.equal(recoveryBadge(state.phase), "Восстановлено");
state = nextRecoveryStatus(state, "connect-success");
assert.equal(state.phase, "connected");
state = nextRecoveryStatus(state, "failed", "network failed");
assert.deepEqual(state, { phase: "failed", message: "network failed" });

const root = path.join(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const guest = read("app/room/page.tsx");
const output = read("app/output/[identity]/page.tsx");
const watch = read("app/watch/page.tsx");
const picker = read("components/MediaDevicePicker.tsx");
const consoleSource = read("components/RoomControlConsole.tsx");

assert.match(guest, /RoomEvent\.Reconnecting/);
assert.match(guest, /RoomEvent\.Reconnected/);
assert.match(guest, /connectionAttempt/);
assert.match(guest, /Повторить подключение/);
assert.match(guest, /devicechange/);
assert.match(guest, /Временно используется системный микрофон/);
assert.match(guest, /Временно используется другая доступная камера/);
assert.match(output, /RoomEvent\.Reconnected, restoreTarget/);
assert.match(watch, /Соединение восстановлено/);
assert.match(picker, /RoomEvent\.Reconnected, apply/);
assert.match(consoleSource, /recoveryBadge\(connectionStatus\.phase\)/);
assert.match(consoleSource, /nextRecoveryStatus\(current, "reconnected"\)/);

console.log("PASS: reconnect phases, retry without refresh, output resubscribe, device fallback/restore and recovered UI");
