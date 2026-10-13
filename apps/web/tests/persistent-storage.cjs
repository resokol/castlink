const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const previous = {
  nodeEnv: process.env.NODE_ENV,
  dataDir: process.env.STUDIOLINK_DATA_DIR,
  installId: process.env.STUDIOLINK_INSTALLATION_ID,
};
const root = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-persistent-"));
process.env.NODE_ENV = "development";
process.env.STUDIOLINK_DATA_DIR = root;
delete process.env.STUDIOLINK_INSTALLATION_ID;

const storage = require("../lib/persistent-storage.ts");

(async () => {
  const first = await storage.validatePersistentStorage();
  assert.match(first.installationId, /^[0-9a-f-]{36}$/i);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "installation.json"), "utf8")).installationId, first.installationId);
  assert.ok(fs.existsSync(path.join(root, "runtime")));
  assert.ok(fs.existsSync(path.join(root, "stats")));

  const second = await storage.validatePersistentStorage();
  assert.equal(second.installationId, first.installationId, "installation identity is stable");

  process.env.STUDIOLINK_INSTALLATION_ID = "00000000-0000-4000-8000-000000000000";
  await assert.rejects(() => storage.validatePersistentStorage(), /does not match/);
  process.env.STUDIOLINK_INSTALLATION_ID = first.installationId;

  const rooms = path.join(root, "runtime", "studiolink-rooms.json");
  fs.writeFileSync(rooms, "{ broken json");
  await assert.rejects(() => storage.validatePersistentStorage(), /unreadable or corrupt/);
  fs.unlinkSync(rooms);

  delete process.env.STUDIOLINK_DATA_DIR;
  process.env.NODE_ENV = "production";
  assert.throws(() => storage.productionDataDir(), /STUDIOLINK_DATA_DIR is required/);

  console.log("PASS: production data dir, stable installation identity, mismatch guard and corrupt JSON startup failure");
})().finally(() => {
  if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
  if (previous.dataDir === undefined) delete process.env.STUDIOLINK_DATA_DIR; else process.env.STUDIOLINK_DATA_DIR = previous.dataDir;
  if (previous.installId === undefined) delete process.env.STUDIOLINK_INSTALLATION_ID; else process.env.STUDIOLINK_INSTALLATION_ID = previous.installId;
  fs.rmSync(root, { recursive: true, force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
