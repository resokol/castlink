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
CASTLINK_SETUP_TOKEN=setup-token-123456789012345678901234567890
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

  for (const file of ["scripts/production-update.sh", "scripts/production-rollback.sh", "scripts/install-ubuntu.sh", "scripts/postgres-backup.sh", "scripts/postgres-restore.sh"]) {
    const syntax = spawnSync("bash", ["-n", file], { cwd: repo, encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);
  }

  const pgBackup = fs.readFileSync(path.join(repo, "scripts/postgres-backup.sh"), "utf8");
  const pgRestore = fs.readFileSync(path.join(repo, "scripts/postgres-restore.sh"), "utf8");
  const update = fs.readFileSync(path.join(repo, "scripts/production-update.sh"), "utf8");
  assert.match(pgBackup, /pg_dump --format=custom/);
  assert.match(pgBackup, /pg_restore --list/);
  assert.match(pgBackup, /sha256sum/);
  assert.match(pgRestore, /--confirm-replace/);
  assert.match(pgRestore, /refusing restore while studiolink-web is running/);
  assert.match(pgRestore, /pg_restore --clean --if-exists --create/);
  assert.match(update, /postgres-backup\.sh/);

  const heartbeatService = fs.readFileSync(path.join(repo, "infrastructure/production/systemd/castlink-node-heartbeat.service"), "utf8");
  const heartbeatTimer = fs.readFileSync(path.join(repo, "infrastructure/production/systemd/castlink-node-heartbeat.timer"), "utf8");
  assert.match(heartbeatService, /NoNewPrivileges=true/);
  assert.match(heartbeatService, /EnvironmentFile=\/opt\/studiolink\/infrastructure\/production\/web\.env/);
  assert.match(heartbeatTimer, /OnUnitActiveSec=15s/);

  const windowsInstaller = fs.readFileSync(path.join(repo, "scripts/install-windows.ps1"), "utf8");
  assert.match(windowsInstaller, /ValidateSet\("public","edge"\)/);
  assert.match(windowsInstaller, /Docker Desktop|docker compose/);
  assert.doesNotMatch(windowsInstaller, /Write-Host.*(dbPassword|sessionSecret|dataKey)/);

  const stubBin = path.join(temp, "bin");
  fs.mkdirSync(stubBin);
  for (const [command, output] of [["id", "0"], ["docker", ""], ["openssl", "generated-secret-fixture"], ["uuidgen", "00000000-0000-4000-8000-000000000000"]]) {
    fs.writeFileSync(path.join(stubBin, command), `#!/bin/sh\nprintf '%s\\n' '${output}'\n`, { mode: 0o700 });
  }
  fs.writeFileSync(path.join(stubBin, "openssl"), "#!/bin/sh\nif [ \"$2\" = -hex ] && { [ \"$3\" = 8 ] || [ \"$3\" = 16 ]; }; then echo public-id-fixture; else echo generated-secret-fixture; fi\n", { mode: 0o700 });
  const installRoot = path.join(temp, "new-install");
  const installed = spawnSync("bash", ["scripts/install-ubuntu.sh", "--image", "example.org/web@sha256:" + "a".repeat(64), "--root", installRoot], { cwd: repo, encoding: "utf8", env: { ...process.env, PATH: stubBin + path.delimiter + process.env.PATH } });
  assert.equal(installed.status, 0, installed.stderr);
  const generated = fs.readFileSync(path.join(installRoot, "infrastructure/production/web.env"), "utf8");
  assert.match(generated, /^CASTLINK_DEPLOYMENT_MODEL=self-hosted$/m);
  assert.match(generated, /^CASTLINK_LICENSE_SERVICE_URL=$/m);
  assert.match(generated, /^CASTLINK_CONTROL_PLANE_URL=$/m);
  assert.doesNotMatch(installed.stdout, /generated-secret-fixture|CastLink Cloud/);
  const preserved = fs.readFileSync(path.join(installRoot, "infrastructure/production/web.env"), "utf8");
  const repeated = spawnSync("bash", ["scripts/install-ubuntu.sh", "--image", "example.org/web@sha256:" + "a".repeat(64), "--root", installRoot], { cwd: repo, encoding: "utf8", env: { ...process.env, PATH: stubBin + path.delimiter + process.env.PATH } });
  assert.notEqual(repeated.status, 0);
  assert.equal(fs.readFileSync(path.join(installRoot, "infrastructure/production/web.env"), "utf8"), preserved);
  const envTemplate = fs.readFileSync(path.join(repo, "infrastructure/production/web.env.example"), "utf8");
  assert.match(envTemplate, /^CASTLINK_DEPLOYMENT_MODEL=self-hosted$/m);
  assert.match(envTemplate, /^CASTLINK_LICENSE_SERVICE_URL=$/m);
  assert.match(envTemplate, /^CASTLINK_CONTROL_PLANE_URL=$/m);
  assert.doesNotMatch(envTemplate, /turn\.castlink\.ru|https:\/\/(?:license|api)\.castlink/);
  const guardIndex = windowsInstaller.indexOf("Refusing to overwrite an existing installation");
  assert.ok(guardIndex >= 0 && guardIndex < windowsInstaller.indexOf("New-Item -ItemType Directory"));
  assert.match(windowsInstaller, /\$sourceRoot = Split-Path -Parent \$PSScriptRoot/);
  assert.match(windowsInstaller, /CASTLINK_DEPLOYMENT_MODEL=\$DeploymentModel/);
  const normalizeIndex = windowsInstaller.indexOf("$DeploymentModel = $DeploymentModel.ToLowerInvariant()");
  assert.ok(normalizeIndex >= 0 && normalizeIndex < windowsInstaller.indexOf("CASTLINK_DEPLOYMENT_MODEL=$DeploymentModel"), "Normalize accepted PowerShell casing before persisting deployment model");
  const dockerfile = fs.readFileSync(path.join(repo, "Dockerfile.web"), "utf8");
  assert.match(dockerfile, /COPY infrastructure\/postgres infrastructure\/postgres/);

  console.log("PASS: production preflight, update/rollback and cross-platform installer safeguards");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
