const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "castlink-backup-restore-"));
const source = path.join(root, "source");
const backup = path.join(root, "backup");
const restored = path.join(root, "restored");
const config = path.join(root, "docker-compose.yml");
const installationId = "11111111-1111-4111-8111-111111111111";

fs.mkdirSync(path.join(source, "runtime"), { recursive: true });
fs.mkdirSync(path.join(source, "stats", "roomhash"), { recursive: true });
fs.writeFileSync(path.join(source, "installation.json"), JSON.stringify({ schemaVersion: 1, installationId, createdAt: new Date().toISOString() }));
fs.writeFileSync(path.join(source, "runtime", "studiolink-rooms.json"), JSON.stringify({ schemaVersion: 1, rooms: [{ name: "room-a" }] }));
fs.writeFileSync(path.join(source, "runtime", "studiolink-moderator-access.json"), JSON.stringify({ schemaVersion: 1, version: "v", scopedInvites: {}, scopedSessions: {} }));
fs.writeFileSync(path.join(source, "stats", "roomhash", "1.jsonl"), JSON.stringify({ room: "room-a", at: 1 }) + "\n");
fs.writeFileSync(config, "services: {}\n");

const repo = path.resolve(__dirname, "../../..");
const run = (script, args) => spawnSync(process.execPath, [path.join(repo, "scripts", script), ...args], { encoding: "utf8" });

try {
  let result = run("storage-backup.mjs", ["--data-dir", source, "--output", backup, "--config", config]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(backup, "manifest.json"), "utf8"));
  assert.equal(manifest.installationId, installationId);
  assert.ok(manifest.files.some(x => x.path === "data/runtime/studiolink-rooms.json"));
  assert.ok(manifest.files.some(x => x.path === "config/docker-compose.yml"));

  result = run("storage-restore.mjs", ["--backup", backup, "--data-dir", restored, "--confirm-stopped"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(restored, "runtime", "studiolink-rooms.json"), "utf8")),
    JSON.parse(fs.readFileSync(path.join(source, "runtime", "studiolink-rooms.json"), "utf8")),
  );
  assert.equal(fs.readFileSync(path.join(restored, "stats", "roomhash", "1.jsonl"), "utf8"), fs.readFileSync(path.join(source, "stats", "roomhash", "1.jsonl"), "utf8"));

  const foreign = path.join(root, "foreign");
  fs.mkdirSync(foreign);
  fs.writeFileSync(path.join(foreign, "installation.json"), JSON.stringify({ schemaVersion: 1, installationId: "22222222-2222-4222-8222-222222222222", createdAt: new Date().toISOString() }));
  result = run("storage-restore.mjs", ["--backup", backup, "--data-dir", foreign, "--confirm-stopped", "--force"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /another installation/);

  fs.writeFileSync(path.join(backup, "data", "runtime", "studiolink-rooms.json"), "tampered");
  const tampered = path.join(root, "tampered");
  result = run("storage-restore.mjs", ["--backup", backup, "--data-dir", tampered, "--confirm-stopped"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /verification failed/);

  console.log("PASS: backup manifest/checksums, full restore, installation guard and tamper detection");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
