const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const access = fs.readFileSync(path.resolve(__dirname, "../lib/super-admin-access.ts"), "utf8");
const accessApi = fs.readFileSync(path.resolve(__dirname, "../app/api/super-admin-access/route.ts"), "utf8");
const overviewApi = fs.readFileSync(path.resolve(__dirname, "../app/api/super-admin/route.ts"), "utf8");
const page = fs.readFileSync(path.resolve(__dirname, "../app/super-admin/page.tsx"), "utf8");
const tokenApi = fs.readFileSync(path.resolve(__dirname, "../app/api/token/route.ts"), "utf8");
const diagnostics = fs.readFileSync(path.resolve(__dirname, "../app/diagnostics/page.tsx"), "utf8");
const health = fs.readFileSync(path.resolve(__dirname, "../app/api/health/route.ts"), "utf8");
const migration = fs.readFileSync(path.resolve(__dirname, "../../../infrastructure/control-plane/002_super_admin.sql"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../package.json"), "utf8"));

assert.match(access, /castlink-super-admin/, "Super Admin must use a dedicated cookie");
assert.match(access, /super-admin-invite/, "Super Admin invite must use a dedicated signed kind");
assert.match(access, /rotateSuperAdminAccessVersion/, "Super Admin revoke must rotate its own access version");

assert.match(accessApi, /action === "bootstrap"/);
assert.match(accessApi, /if \(!isStudio\(request\)\)/, "legacy platform owner may bootstrap but is not the Super Admin cookie itself");
assert.match(accessApi, /await isSuperAdmin\(request\)/, "privileged Super Admin actions require the dedicated session");
assert.match(accessApi, /action === "revoke"/);

assert.match(overviewApi, /if \(!\(await isSuperAdmin\(request\)\)\)/, "cluster overview must be Super Admin only");
assert.match(overviewApi, /listControlNodes/);
assert.match(overviewApi, /listAllStudios/);
assert.match(overviewApi, /listControlRooms/);

for (const forbidden of ["livekit-client", "RoomAudioRenderer", "ScreenShareButton", "setCameraEnabled", "setMicrophoneEnabled", "ON AIR"]) {
  assert.ok(!page.includes(forbidden), `Super Admin page must not contain broadcast media control: ${forbidden}`);
}
assert.match(page, /\/api\/super-admin/);
assert.match(page, /Создать Super Admin link/);
assert.match(page, /Ноды/);
assert.match(page, /Студии/);
assert.match(page, /Комнаты/);

assert.ok(!tokenApi.includes('"super-admin"'), "LiveKit token endpoint must not recognize Super Admin as a media role");
assert.match(migration, /castlink_control\.platform_access/);
assert.match(migration, /super_admin/);
assert.equal(packageJson.scripts["control-plane:migrate"], "node scripts/control-plane-migrate.mjs");

assert.match(diagnostics, /\/super-admin/);
assert.match(diagnostics, /намеренно не показывает tenant topology/);
assert.ok(!health.includes("listControlNodes"), "limited diagnostics must not expose cluster topology");
assert.ok(!health.includes("listAllStudios"), "limited diagnostics must not expose tenant list");
assert.match(health, /controlPlaneMode/);
assert.match(health, /nodeId/);

console.log("PASS: isolated Super Admin access, no media grants, protected topology and limited diagnostics boundary");
