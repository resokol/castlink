const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const { verifyLicenseToken } = require("../lib/license.ts");
const { verifyServerLease } = require("../lib/server-lease.ts");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const now = Date.now();
const installationId = "00000000-0000-4000-8000-000000000000";
const serverId = "server-test-0001";

function token(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = sign(null, body, privateKey);
  return `${body.toString("base64url")}.${signature.toString("base64url")}`;
}

const licensePayload = {
  schemaVersion: 1,
  licenseId: "license-0001",
  customer: "Test Customer",
  installationId,
  issuedAt: new Date(now - 60_000).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString(),
  offlineGraceUntil: new Date(now + 3600_000).toISOString(),
  maxServers: 2,
  features: ["rooms", "server-transfer"],
};

const active = verifyLicenseToken(token(licensePayload), installationId, now, publicPem);
assert.equal(active.ok, true);
assert.equal(active.state, "active");

const wrongInstall = verifyLicenseToken(token(licensePayload), "11111111-1111-4111-8111-111111111111", now, publicPem);
assert.equal(wrongInstall.ok, false);
assert.equal(wrongInstall.state, "wrong_installation");

const signedLicense = token(licensePayload);
const [signedBody, signedSignature] = signedLicense.split(".");
const decodedBody = JSON.parse(Buffer.from(signedBody, "base64url").toString("utf8"));
decodedBody.maxServers = 999;
const tampered = `${Buffer.from(JSON.stringify(decodedBody)).toString("base64url")}.${signedSignature}`;
assert.equal(verifyLicenseToken(tampered, installationId, now, publicPem).ok, false);

const leasePayload = {
  schemaVersion: 1,
  leaseId: "lease-0001",
  licenseId: "license-0001",
  organizationId: "org-0001",
  serverId,
  installationId,
  serverType: "self-hosted",
  issuedAt: new Date(now - 60_000).toISOString(),
  validUntil: new Date(now + 60_000).toISOString(),
  graceUntil: new Date(now + 3600_000).toISOString(),
  features: ["rooms", "server-transfer"],
};

const lease = verifyServerLease(token(leasePayload), { installationId, serverId }, now, publicPem);
assert.equal(lease.ok, true);
assert.equal(lease.state, "active");

const wrongServer = verifyServerLease(token(leasePayload), { installationId, serverId: "server-other" }, now, publicPem);
assert.equal(wrongServer.ok, false);
assert.equal(wrongServer.state, "wrong_server");

const expiredPayload = {
  ...leasePayload,
  issuedAt: new Date(now - 3600_000).toISOString(),
  validUntil: new Date(now - 120_000).toISOString(),
  graceUntil: new Date(now - 60_000).toISOString(),
};
const expired = verifyServerLease(token(expiredPayload), { installationId, serverId }, now, publicPem);
assert.equal(expired.ok, false);
assert.equal(expired.state, "expired");

console.log("PASS: Ed25519 license/lease signatures, installation binding, server binding and expiry checks");
