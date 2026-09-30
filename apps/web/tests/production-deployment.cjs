const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repo = path.resolve(__dirname, "../../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-prod-preflight-"));
fs.copyFileSync(path.join(repo, "infrastructure/production/docker-compose.yml"), path.join(temp, "docker-compose.yml"));

const web = `
NODE_ENV=production
STUDIOLINK_DATA_DIR=/data
STUDIOLINK_INSTALLATION_ID=00000000-0000-4000-8000-000000000000
CASTLINK_STORAGE_BACKEND=json
DATABASE_URL=postgresql://castlink:test-password@postgres:5432/castlink
LIVEKIT_API_KEY=test-key
LIVEKIT_API_SECRET=test-secret-123456789012345678901234
STUDIOLINK_STUDIO_PASSWORD_HASH=test-hash
CASTLINK_SESSION_SECRET=session-secret-123456789012345678901234
CASTLINK_DATA_ENCRYPTION_KEY=data-key-123456789012345678901234
`.trim() + "\n";
const postgres = `
POSTGRES_USER=castlink
POSTGRES_DB=castlink
POSTGRES_PASSWORD=test-password
`.trim() + "\n";

fs.writeFileSync(path.join(temp, "web.env"), web);
fs.writeFileSync(path.join(temp, "postgres.env"), postgres);

function run(image) {
  return spawnSync(process.execPath, ["scripts/production-preflight.mjs", temp], {
    cwd: repo,
    env: { ...process.env, CASTLINK_WEB_IMAGE: image },
    encoding: "utf8",
  });
}

try {
  const ok = run("studiolink_web:1.0.0-deadbee");
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  assert.match(ok.stdout, /"ok":true/);
  assert.doesNotMatch(ok.stdout, /test-password|test-secret|session-secret|data-key/);

  const latest = run("studiolink_web:latest");
  assert.notEqual(latest.status, 0);
  assert.match(latest.stderr + latest.stdout, /must not use latest/);

  fs.writeFileSync(path.join(temp, "web.env"), web.replace("LIVEKIT_API_SECRET=test-secret-123456789012345678901234", "LIVEKIT_API_SECRET=CHANGE_ME"));
  const placeholder = run("studiolink_web:1.0.0-deadbee");
  assert.notEqual(placeholder.status, 0);
  assert.match(placeholder.stderr + placeholder.stdout, /LIVEKIT_API_SECRET/);

  for (const file of ["scripts/production-update.sh", "scripts/production-rollback.sh"]) {
    const syntax = spawnSync("bash", ["-n", file], { cwd: repo, encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);
  }

  console.log("PASS: production preflight rejects mutable/placeholder config and deployment shell syntax is valid");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
