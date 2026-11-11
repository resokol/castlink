import { readFile, statfs, access } from "node:fs/promises";
import os from "node:os";
import { RoomServiceClient } from "livekit-server-sdk";
import { readNodeRoomInventory } from "./room-store";
import { productionDataDir } from "./persistent-storage";
import type { MonitorScope, ServerMonitorSample } from "./server-monitor-types";
import { serverObservabilityStore, MONITOR_INTERVAL_MS, OBSERVABILITY_RETENTION_MS, observabilitySamplerRunning } from "./server-observability-store";

const MAX_GAP_MS = 45000;
type CpuCounter = { at: number; idle: number; total: number };
type NetworkCounter = { at: number; interfaces: Record<string, { rx: number; tx: number }> };

export function cpuUsage(before: CpuCounter | null, after: CpuCounter): number | null {
  if (!before || after.at <= before.at || after.at - before.at > MAX_GAP_MS) return null;
  const total = after.total - before.total, idle = after.idle - before.idle;
  if (total <= 0 || idle < 0 || idle > total) return null;
  return 100 * (total - idle) / total;
}

export function parseNetwork(routes: string, devices: string, at: number): NetworkCounter {
  // Select default interfaces only: summing bridges/veth/loopback would count the same traffic twice.
  const selected = new Set(routes.split("\n").map(line => line.trim().split(/\s+/)).filter(fields => fields[1] === "00000000").map(fields => fields[0]));
  const interfaces: NetworkCounter["interfaces"] = {};
  for (const line of devices.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim(), fields = line.slice(colon + 1).trim().split(/\s+/);
    if (selected.has(name) && Number.isFinite(Number(fields[0])) && Number.isFinite(Number(fields[8]))) interfaces[name] = { rx: Number(fields[0]), tx: Number(fields[8]) };
  }
  return { at, interfaces };
}

export function networkRates(before: NetworkCounter | null, after: NetworkCounter | null) {
  const unavailable = { inMbps: null, outMbps: null };
  if (!before || !after || after.at <= before.at || after.at - before.at > MAX_GAP_MS) return unavailable;
  const names = Object.keys(after.interfaces).sort();
  if (!names.length || names.join("\0") !== Object.keys(before.interfaces).sort().join("\0")) return unavailable;
  let rx = 0, tx = 0;
  for (const name of names) {
    const a = after.interfaces[name], b = before.interfaces[name];
    if (a.rx < b.rx || a.tx < b.tx) return unavailable;
    rx += a.rx - b.rx; tx += a.tx - b.tx;
  }
  const factor = 8 / (after.at - before.at) / 1000;
  return { inMbps: rx * factor, outMbps: tx * factor };
}

async function runtimeScope(): Promise<MonitorScope> {
  if (await access("/.dockerenv").then(() => true, () => false)) return "container";
  return /microsoft|wsl/i.test(os.release()) ? "wsl" : "host";
}

async function memory() {
  try {
    if (process.platform === "linux") {
      const text = await readFile("/proc/meminfo", "utf8");
      const total = Number(text.match(/^MemTotal:\s+(\d+)/m)?.[1]) * 1024;
      const available = Number(text.match(/^MemAvailable:\s+(\d+)/m)?.[1]) * 1024;
      if (total > 0 && available >= 0 && available <= total) return { memoryTotalBytes: total, memoryUsedBytes: total - available };
      return { memoryTotalBytes: null, memoryUsedBytes: null };
    }
    const total = os.totalmem();
    return { memoryTotalBytes: total, memoryUsedBytes: total - os.freemem() };
  } catch { return { memoryTotalBytes: null, memoryUsedBytes: null }; }
}

async function disk() {
  try {
    const stats = await statfs(productionDataDir());
    return { diskTotalBytes: stats.blocks * stats.bsize, diskUsedBytes: (stats.blocks - stats.bfree) * stats.bsize, diskAvailableBytes: stats.bavail * stats.bsize };
  } catch { return { diskTotalBytes: null, diskUsedBytes: null, diskAvailableBytes: null }; }
}

async function mediaCounts() {
  const configured = !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
  if (!configured) return { activeRooms: null, connections: null, casters: null, livekit: "unconfigured" as const };
  // Each RoomService request is bounded by the SDK's HTTP timeout; limit parallel room reads.
  try {
    const client = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { requestTimeout: 3 });
    const rooms = await client.listRooms();
    const deadline = Date.now() + 4000;
    let next = 0, connections = 0, casters = 0;
    const worker = async () => {
      while (next < rooms.length) {
        if (Date.now() >= deadline) throw new Error("media_snapshot_timeout");
        const room = rooms[next++];
        const participants = await client.listParticipants(room.name);
        connections += participants.length;
        casters += participants.filter(person => person.identity.startsWith("guest-")).length;
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, rooms.length) }, worker));
    return { activeRooms: rooms.length, connections, casters, livekit: "ok" as const };
  } catch { return { activeRooms: null, connections: null, casters: null, livekit: "unavailable" as const }; }
}

let previousCpu: CpuCounter | null = null, previousNetwork: NetworkCounter | null = null;
export async function collectServerMonitorSample(): Promise<ServerMonitorSample> {
  const at = Date.now();
  const cpus = os.cpus();
  const cpu = { at, idle: cpus.reduce((sum, item) => sum + item.times.idle, 0), total: cpus.reduce((sum, item) => sum + Object.values(item.times).reduce((a, b) => a + b, 0), 0) };
  const [ram, storage, network, inventory, media] = await Promise.all([
    memory(), disk(),
    Promise.all([readFile("/proc/net/route", "utf8"), readFile("/proc/net/dev", "utf8")]).then(([routes, devices]) => parseNetwork(routes, devices, at)).catch(() => null),
    readNodeRoomInventory().then(rooms => rooms.length).catch(() => null),
    mediaCounts(),
  ]);
  const cpuPercent = cpuUsage(previousCpu, cpu), rates = networkRates(previousNetwork, network);
  previousCpu = cpu; previousNetwork = network;
  return {
    at, cpuPercent, ...ram, ...storage, networkInMbps: rates.inMbps, networkOutMbps: rates.outMbps,
    processRssBytes: process.memoryUsage().rss, processUptimeSec: Math.floor(process.uptime()),
    configuredRooms: inventory, activeRooms: media.activeRooms, connections: media.connections, casters: media.casters,
    services: { web: "ok", livekit: media.livekit, roomStore: inventory === null ? "unavailable" : "ok" },
  };
}

export async function readServerMonitor(windowMs = 3600000) {
  const scope = await runtimeScope();
  try {
    const snapshot = serverObservabilityStore().readMetrics(windowMs);
    return { ...snapshot, scope, generatedAt: Date.now(), intervalMs: MONITOR_INTERVAL_MS, retentionMs: OBSERVABILITY_RETENTION_MS };
  } catch {
    return { history: [], latest: null, windowMs, resolutionMs: MONITOR_INTERVAL_MS, aggregation: "raw" as const, scope, generatedAt: Date.now(), intervalMs: MONITOR_INTERVAL_MS, retentionMs: OBSERVABILITY_RETENTION_MS, storage: { state: "unavailable" as const, droppedEvents: 0, samplerRunning: observabilitySamplerRunning() } };
  }
}
