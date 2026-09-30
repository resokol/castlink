const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { signNodeControlRequest, verifyNodeControlRequest } = require("../lib/node-control-auth.ts");

const secret = "node-control-secret-abcdefghijklmnopqrstuvwxyz";
const now = Date.now();
const timestamp = String(now);
const pathAndQuery = "/v1/control/studio?studioId=studio-alpha";
const signature = signNodeControlRequest(secret, timestamp, "GET", pathAndQuery);

assert.equal(verifyNodeControlRequest(secret, timestamp, "GET", pathAndQuery, signature, now), true);
assert.equal(verifyNodeControlRequest(secret, timestamp, "GET", "/v1/control/studio?studioId=studio-bravo", signature, now), false, "signature binds studioId/path");
assert.equal(verifyNodeControlRequest(secret, timestamp, "POST", pathAndQuery, signature, now), false, "signature binds HTTP method");
assert.equal(verifyNodeControlRequest(secret, String(now - 120000), "GET", pathAndQuery, signNodeControlRequest(secret, String(now - 120000), "GET", pathAndQuery), now), false, "stale internal request rejected");

const route = fs.readFileSync(path.resolve(__dirname, "../app/v1/control/studio/route.ts"), "utf8");
const client = fs.readFileSync(path.resolve(__dirname, "../lib/control-plane-client.ts"), "utf8");
const owner = fs.readFileSync(path.resolve(__dirname, "../lib/studio-owner-access.ts"), "utf8");

assert.match(route, /heartbeatSecretForNode\(nodeId\)/);
assert.match(route, /verifyNodeControlRequest\(secret, timestamp, "GET", pathAndQuery, signature\)/);
assert.match(route, /studioOwnerAccessVersion\(studioId\)/);
assert.match(route, /resolveStudioRoute\(studioId\)/);
assert.match(route, /node\.state === "disabled"/);

assert.match(client, /CASTLINK_CONTROL_PLANE_URL/);
assert.match(client, /CASTLINK_NODE_ID/);
assert.match(client, /CASTLINK_NODE_SECRET/);
assert.match(client, /x-castlink-node-signature/);
assert.match(client, /currentStudioOwnerAccessVersion/);
assert.match(client, /currentStudioRoute/);
assert.match(owner, /currentStudioOwnerAccessVersion\(scope\)/);

console.log("PASS: node control-plane reads are HTTPS/HMAC signed, path-bound and owner/routing reads use the client abstraction");
