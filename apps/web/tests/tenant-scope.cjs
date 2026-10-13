const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const { tenantKey, sameStudio, sameRoom, validateTenantScope } = require("../lib/tenant-scope.ts");

const a = { organizationId: "org-alpha", studioId: "studio-main", roomId: "room-caster" };
const b = { organizationId: "org-alpha", studioId: "studio-main", roomId: "room-caster" };
const c = { organizationId: "org-alpha", studioId: "studio-main", roomId: "room-analyst" };
const d = { organizationId: "org-beta1", studioId: "studio-main", roomId: "room-caster" };

assert.equal(tenantKey(a), "org-alpha/studio-main/room-caster");
assert.equal(sameStudio(a, b), true);
assert.equal(sameRoom(a, b), true);
assert.equal(sameRoom(a, c), false);
assert.equal(sameStudio(a, d), false);
assert.equal(sameRoom(a, d), false);

assert.throws(() => validateTenantScope({ organizationId: "../etc", studioId: "studio-main" }), /Invalid organizationId/);
assert.throws(() => validateTenantScope({ organizationId: "org-alpha", studioId: "x" }), /Invalid studioId/);

console.log("PASS: tenant scope prevents cross-organization/studio room identity collisions");
