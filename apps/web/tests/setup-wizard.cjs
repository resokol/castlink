const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-setup-"));
const previous = {
  nodeEnv: process.env.NODE_ENV,
  dataDir: process.env.STUDIOLINK_DATA_DIR,
  setupToken: process.env.CASTLINK_SETUP_TOKEN,
  deploymentModel: process.env.CASTLINK_DEPLOYMENT_MODEL,
};
process.env.NODE_ENV = "development";
process.env.STUDIOLINK_DATA_DIR = root;
process.env.CASTLINK_SETUP_TOKEN = "setup-test-secret";
process.env.CASTLINK_DEPLOYMENT_MODEL = "legacy";

const setup = require("../lib/setup-state.ts");

(async () => {
  assert.equal(await setup.setupRequired(), true);
  assert.equal(setup.validSetupToken("wrong"), false);
  assert.equal(setup.validSetupToken("setup-test-secret"), true);

  await setup.completeSetup({ serverName: "Office", mode: "edge" });
  assert.equal(await setup.setupRequired(), false);

  const stored = JSON.parse(fs.readFileSync(path.join(root, "runtime", "castlink-setup.json"), "utf8"));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.serverName, "Office");
  assert.equal(stored.mode, "edge");
  assert.equal(typeof stored.completedAt, "string");
  assert.equal(JSON.stringify(stored).includes("setup-test-secret"), false);

  const api = fs.readFileSync(path.resolve(__dirname, "../app/api/setup/route.ts"), "utf8");
  assert.match(api, /x-castlink-setup-token/);
  assert.match(api, /setupRequired/);
  assert.match(api, /validSetupToken/);
  assert.doesNotMatch(api, /installationId.*GET|serverId.*GET/);

  console.log("PASS: first-run setup token is one-time gated and never persisted");
})().finally(() => {
  if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
  if (previous.dataDir === undefined) delete process.env.STUDIOLINK_DATA_DIR; else process.env.STUDIOLINK_DATA_DIR = previous.dataDir;
  if (previous.deploymentModel === undefined) delete process.env.CASTLINK_DEPLOYMENT_MODEL; else process.env.CASTLINK_DEPLOYMENT_MODEL = previous.deploymentModel;
  if (previous.setupToken === undefined) delete process.env.CASTLINK_SETUP_TOKEN; else process.env.CASTLINK_SETUP_TOKEN = previous.setupToken;
  fs.rmSync(root, { recursive: true, force: true });
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
