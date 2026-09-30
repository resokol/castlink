import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const baseUrl = (process.env.CASTLINK_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const output = path.resolve(process.argv[2] || `castlink-support-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

async function fetchJson(pathname) {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(Number(process.env.CASTLINK_SUPPORT_TIMEOUT_MS || 3000)),
    });
    let body = null;
    try { body = await response.json(); } catch {}
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - started,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.name : "request_error",
    };
  }
}

const [version, health] = await Promise.all([
  fetchJson("/api/version"),
  fetchJson("/api/health"),
]);

const bundle = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemoryMiB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMiB: Math.round(os.freemem() / 1024 / 1024),
  },
  endpoints: {
    version,
    health,
  },
};

await writeFile(output, JSON.stringify(bundle, null, 2) + "\n", { mode: 0o600 });
console.log(output);
