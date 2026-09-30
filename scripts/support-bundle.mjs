import { writeFile } from "node:fs/promises";
import net from "node:net";
import tls from "node:tls";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const output = path.resolve(process.argv[2] || `castlink-support-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const livekitUrl = new URL(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880");
const turnHost = process.env.CASTLINK_TURN_HEALTH_HOST?.trim() || "turn.castlink.ru";
const turnPort = Number(process.env.CASTLINK_TURN_TLS_PORT || 443);
const timeout = Number(process.env.CASTLINK_SUPPORT_TIMEOUT_MS || 3000);

function checkTcp(host, port) {
  const started = Date.now();
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ ...result, latencyMs: Date.now() - started });
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("timeout", () => finish({ ok: false, error: "timeout" }));
    socket.once("error", error => finish({ ok: false, error: typeof error?.code === "string" ? error.code : "connect_error" }));
  });
}

function checkTls(host, port) {
  const started = Date.now();
  return new Promise(resolve => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ ...result, latencyMs: Date.now() - started });
    };
    socket.setTimeout(timeout);
    socket.once("secureConnect", () => finish({ ok: socket.authorized, ...(socket.authorized ? {} : { error: "tls_error" }) }));
    socket.once("timeout", () => finish({ ok: false, error: "timeout" }));
    socket.once("error", error => finish({ ok: false, error: typeof error?.code === "string" ? error.code : "tls_error" }));
  });
}

const livekitPort = Number(livekitUrl.port || (livekitUrl.protocol === "https:" ? 443 : 80));
const [livekit, turnTls] = await Promise.all([
  checkTcp(livekitUrl.hostname, livekitPort),
  checkTls(turnHost, turnPort),
]);

const configuredStatsMax = Number(process.env.STUDIOLINK_STATS_MAX_BYTES);
const statsMaxBytes = Number.isSafeInteger(configuredStatsMax) && configuredStatsMax >= 64 * 1024 * 1024
  ? configuredStatsMax
  : 512 * 1024 * 1024;

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
  config: {
    storageBackend: (process.env.CASTLINK_STORAGE_BACKEND || "json").trim().toLowerCase(),
    statsRetentionHours: 26,
    statsMaxBytes,
  },
  checks: { livekit, turnTls },
};

await writeFile(output, JSON.stringify(bundle, null, 2) + "\n", { mode: 0o600 });
console.log(output);
