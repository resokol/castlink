const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { Pool } = require("pg");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL = connectionString;
process.env.CASTLINK_DEFAULT_ORGANIZATION_ID = "org-owner-test";
process.env.CASTLINK_SESSION_SECRET = "owner-integration-session-secret-1234567890";
process.env.LIVEKIT_API_SECRET = "legacy-owner-integration-secret";

const store = require("../lib/control-plane-store.ts");
const owner = require("../lib/studio-owner-access.ts");
const pool = new Pool({ connectionString, max: 1 });

(async () => {
  const schema = fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/control-plane/001_multitenant.sql"), "utf8");
  await pool.query(schema);

  await pool.query("DELETE FROM castlink_control.studios WHERE organization_id='org-owner-test'");
  await pool.query("DELETE FROM castlink_control.organizations WHERE organization_id='org-owner-test'");
  await pool.query("INSERT INTO castlink_control.organizations(organization_id,name) VALUES('org-owner-test','Owner Test')");

  const studioA = await store.createStudio("Owner A", "org-owner-test");
  const studioB = await store.createStudio("Owner B", "org-owner-test");

  const inviteA = await owner.newStudioOwnerInvite(studioA.studioId);
  const inviteB = await owner.newStudioOwnerInvite(studioB.studioId);

  assert.ok(await owner.validStudioOwnerInvite(inviteA.invite, studioA.studioId));
  assert.equal(await owner.validStudioOwnerInvite(inviteA.invite, studioB.studioId), null, "Studio A owner-link cannot authorize Studio B");
  assert.ok(await owner.validStudioOwnerInvite(inviteB.invite, studioB.studioId));

  await owner.revokeStudioOwnerAccess(studioA.studioId);
  assert.equal(await owner.validStudioOwnerInvite(inviteA.invite, studioA.studioId), null, "revoked owner-link stops authorizing");
  assert.ok(await owner.validStudioOwnerInvite(inviteB.invite, studioB.studioId), "revoking Studio A leaves Studio B access intact");

  console.log("PASS: signed owner-links are isolated per Studio and revocation is tenant-local");
})().finally(async () => {
  await store.closeControlPlanePool().catch(() => undefined);
  await pool.query("DELETE FROM castlink_control.studios WHERE organization_id='org-owner-test'").catch(() => undefined);
  await pool.query("DELETE FROM castlink_control.organizations WHERE organization_id='org-owner-test'").catch(() => undefined);
  await pool.end();
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
