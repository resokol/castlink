const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");

Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const previous = {
  livekit: process.env.LIVEKIT_API_SECRET,
  session: process.env.CASTLINK_SESSION_SECRET,
  data: process.env.CASTLINK_DATA_ENCRYPTION_KEY,
};
process.env.LIVEKIT_API_SECRET = "legacy-livekit-secret-for-security-test";
delete process.env.CASTLINK_SESSION_SECRET;
delete process.env.CASTLINK_DATA_ENCRYPTION_KEY;

const access = require("../lib/access.ts");
const legacyToken = access.signAccess({ kind: "security-test", version: "legacy" }, 60);
const legacyCiphertext = access.encryptRoomPassword("legacy-room-password");
assert.equal(access.readAccess(legacyToken)?.kind, "security-test");
assert.equal(access.decryptRoomPassword(legacyCiphertext), "legacy-room-password");

process.env.CASTLINK_SESSION_SECRET = "dedicated-session-secret-for-security-test";
process.env.CASTLINK_DATA_ENCRYPTION_KEY = "dedicated-data-key-for-security-test";

assert.equal(access.readAccess(legacyToken)?.version, "legacy", "legacy session remains readable during migration");
assert.equal(access.decryptRoomPassword(legacyCiphertext), "legacy-room-password", "legacy ciphertext remains readable during migration");

const dedicatedToken = access.signAccess({ kind: "security-test", version: "dedicated" }, 60);
const dedicatedCiphertext = access.encryptRoomPassword("dedicated-room-password");
assert.equal(access.readAccess(dedicatedToken)?.version, "dedicated");
assert.equal(access.decryptRoomPassword(dedicatedCiphertext), "dedicated-room-password");

delete process.env.CASTLINK_SESSION_SECRET;
delete process.env.CASTLINK_DATA_ENCRYPTION_KEY;
assert.equal(access.readAccess(dedicatedToken), null, "new sessions are signed by the dedicated secret");
assert.equal(access.decryptRoomPassword(dedicatedCiphertext), "", "new room passwords are encrypted with the dedicated data key");

if (previous.livekit === undefined) delete process.env.LIVEKIT_API_SECRET; else process.env.LIVEKIT_API_SECRET = previous.livekit;
if (previous.session === undefined) delete process.env.CASTLINK_SESSION_SECRET; else process.env.CASTLINK_SESSION_SECRET = previous.session;
if (previous.data === undefined) delete process.env.CASTLINK_DATA_ENCRYPTION_KEY; else process.env.CASTLINK_DATA_ENCRYPTION_KEY = previous.data;

console.log("PASS: dedicated session/data secrets with legacy migration fallback");
