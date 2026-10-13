import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const valueOf = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const has = flag => args.includes(flag);
const rawBackup = valueOf("--backup") || "";
const rawDataDir = valueOf("--data-dir") || process.env.STUDIOLINK_DATA_DIR || "";
const backup = rawBackup ? path.resolve(rawBackup) : "";
const dataDir = rawDataDir ? path.resolve(rawDataDir) : "";
const configDir = valueOf("--config-dir") ? path.resolve(valueOf("--config-dir")) : null;
if (!backup || !dataDir || dataDir === path.parse(dataDir).root || !has("--confirm-stopped")) {
  console.error("Usage: node scripts/storage-restore.mjs --backup <dir> --data-dir <dir> --confirm-stopped [--force] [--replace-installation] [--config-dir <dir>]");
  process.exit(2);
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
async function sha256(p) { return createHash("sha256").update(await readFile(p)).digest("hex"); }
function safeRelative(rel) {
  const normalized = path.posix.normalize(String(rel).replaceAll("\\", "/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) throw new Error("Unsafe manifest path");
  return normalized;
}

const manifest = JSON.parse(await readFile(path.join(backup, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== 1 || typeof manifest.installationId !== "string" || !Array.isArray(manifest.files)) throw new Error("Unsupported backup manifest");

for (const entry of manifest.files) {
  const rel = safeRelative(entry.path);
  const source = path.join(backup, ...rel.split("/"));
  const info = await stat(source);
  if (!info.isFile() || info.size !== entry.bytes || await sha256(source) !== entry.sha256) throw new Error("Backup verification failed: " + rel);
}

const existingIdentityPath = path.join(dataDir, "installation.json");
if (await exists(existingIdentityPath)) {
  const existing = JSON.parse(await readFile(existingIdentityPath, "utf8"));
  if (existing.installationId !== manifest.installationId && !has("--replace-installation")) {
    throw new Error("Backup belongs to another installation; pass --replace-installation only for an intentional full replacement");
  }
}
if (await exists(dataDir) && (await readdir(dataDir)).length && !has("--force")) {
  throw new Error("Destination is not empty; make a fresh backup and pass --force for an intentional restore");
}

const parent = path.dirname(dataDir);
await mkdir(parent, { recursive: true });
const stage = path.join(parent, "." + path.basename(dataDir) + ".restore-" + Date.now());
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true, mode: 0o700 });

for (const entry of manifest.files.filter(x => safeRelative(x.path).startsWith("data/"))) {
  const rel = safeRelative(entry.path).slice("data/".length);
  const source = path.join(backup, ...safeRelative(entry.path).split("/"));
  const target = path.join(stage, ...rel.split("/"));
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await copyFile(source, target);
}

let rollback = null;
try {
  if (await exists(dataDir)) {
    rollback = dataDir + ".pre-restore-" + new Date().toISOString().replaceAll(/[:.]/g, "-");
    await rename(dataDir, rollback);
  }
  await rename(stage, dataDir);
} catch (error) {
  if (!(await exists(dataDir)) && rollback && await exists(rollback)) await rename(rollback, dataDir).catch(() => undefined);
  throw error;
}

if (configDir) {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const configEntries = manifest.files.filter(x => safeRelative(x.path).startsWith("config/"));
  for (const entry of configEntries) {
    const rel = safeRelative(entry.path).slice("config/".length);
    const source = path.join(backup, ...safeRelative(entry.path).split("/"));
    const target = path.join(configDir, path.basename(rel));
    await copyFile(source, target);
  }
}

console.log("Restore complete: " + dataDir);
console.log("Installation: " + manifest.installationId);
if (rollback) console.log("Previous data retained at: " + rollback);
