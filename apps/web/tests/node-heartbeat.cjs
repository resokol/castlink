const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const { canonicalHeartbeatBody, signHeartbeat, verifyHeartbeatSignature, validateHeartbeat } = require("../lib/node-heartbeat.ts");
const { heartbeatSecretForNode } = require("../lib/node-heartbeat-auth.ts");

const now = Date.now();
const heartbeat = {
  schemaVersion: 1,
  nodeId: "node-vps-01",
  sentAt: now,
  region: "frankfurt",
  nodeType: "cloud",
  activeStudios: 2,
  activeParticipants: 8,
  activeVideoTracks: 10,
  cpuLoad: 0.35,
  memoryLoad: 0.42,
};

const body = canonicalHeartbeatBody(heartbeat);
const signature = signHeartbeat(body, "node-secret");
assert.equal(verifyHeartbeatSignature(body, signature, "node-secret"), true);
assert.equal(verifyHeartbeatSignature(body.replace('"activeStudios":2', '"activeStudios":3'), signature, "node-secret"), false);
assert.deepEqual(validateHeartbeat(heartbeat, now), heartbeat);
assert.throws(() => validateHeartbeat({ ...heartbeat, sentAt: now - 120000 }, now), /Stale heartbeat/);
assert.throws(() => validateHeartbeat({ ...heartbeat, activeParticipants: -1 }, now), /activeParticipants/);
assert.throws(() => validateHeartbeat({ ...heartbeat, cpuLoad: 1.5 }, now), /cpuLoad/);

const previousSecrets = process.env.CASTLINK_NODE_SECRETS_JSON;
process.env.CASTLINK_NODE_SECRETS_JSON = JSON.stringify({
  "node-vps-01": "abcdefghijklmnopqrstuvwxyz0123456789-node-secret",
});
assert.equal(heartbeatSecretForNode("node-vps-01"), "abcdefghijklmnopqrstuvwxyz0123456789-node-secret");
assert.equal(heartbeatSecretForNode("node-home-01"), null);
process.env.CASTLINK_NODE_SECRETS_JSON = "{broken";
assert.equal(heartbeatSecretForNode("node-vps-01"), null);
if (previousSecrets === undefined) delete process.env.CASTLINK_NODE_SECRETS_JSON;
else process.env.CASTLINK_NODE_SECRETS_JSON = previousSecrets;

const route = fs.readFileSync(require.resolve("../app/v1/nodes/heartbeat/route.ts"), "utf8");
assert.match(route, /x-castlink-node-id/);
assert.match(route, /x-castlink-node-signature/);
assert.match(route, /verifyHeartbeatSignature\(raw, signature, secret\)/);
assert.match(route, /validateHeartbeat\(payload\)/);
assert.match(route, /applyNodeHeartbeat\(heartbeat\)/);

console.log("PASS: node heartbeat signing/auth rejects tampering and validates freshness/load fields");
