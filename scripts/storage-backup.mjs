import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const valueOf = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const rawDataDir = valueOf("--data-dir") || process.env.STUDIOLINK_DATA_DIR || "";
const rawOutput = valueOf("--output") || "";
const dataDir = rawDataDir ? path.resolve(rawDataDir) : "";
const output = rawOutput ? path.resolve(rawOutput) : "";
if (!dataDir || dataDir === path.parse(dataDir).root || !output) {
  console.error("Usage: node scripts/storage-backup.mjs --data-dir <dir> --output <empty-dir> [--config <file> ...]");
  process.exit(2);
}
const configs = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--config" && args[i + 1]) configs.push(path.resolve(args[++i]));

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
async function sha256(p) { const b = await readFile(p); return createHash("sha256").update(b).digest("hex"); }
async function walk(root, rel = "") {
  const out = [];
  for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) out.push(...await walk(root, child));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

if (!(await exists(dataDir))) throw new Error("Data directory not found: " + dataDir);
if (await exists(output)) {
  if ((await readdir(output)).length) throw new Error("Backup destination is not empty: " + output);
} else await mkdir(output, { recursive: true, mode: 0o700 });

const installationPath = path.join(dataDir, "installation.json");
const installation = JSON.parse(await readFile(installationPath, "utf8"));
if (installation.schemaVersion !== 1 || typeof installation.installationId !== "string") throw new Error("Invalid installation.json");

const files = [];
for (const rel of await walk(dataDir)) {
  const source = path.join(dataDir, rel);
  if (rel.startsWith("runtime" + path.sep) && rel.endsWith(".json")) JSON.parse(await readFile(source, "utf8"));
  const targetRel = path.join("data", rel);
  const target = path.join(output, targetRel);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await copyFile(source, target);
  const info = await stat(target);
  files.push({ path: targetRel.split(path.sep).join("/"), bytes: info.size, sha256: await sha256(target) });
}

const usedNames = new Set();
for (const source of configs) {
  if (!(await exists(source))) throw new Error("Config file not found: " + source);
  let name = path.basename(source), n = 2;
  while (usedNames.has(name)) name = path.basename(source, path.extname(source)) + "-" + n++ + path.extname(source);
  usedNames.add(name);
  const targetRel = path.join("config", name), target = path.join(output, targetRel);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await copyFile(source, target);
  const info = await stat(target);
  files.push({ path: targetRel.split(path.sep).join("/"), bytes: info.size, sha256: await sha256(target) });
}

const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), installationId: installation.installationId, files: files.sort((a, b) => a.path.localeCompare(b.path)) };
await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
console.log("Backup complete: " + output);
console.log("Installation: " + manifest.installationId);
console.log("Files: " + manifest.files.length);
