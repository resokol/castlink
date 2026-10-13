import { createRequire } from "node:module";
import os from "node:os";
import { sampleHostNetwork } from "./heartbeat-host-metrics.mjs";
import process from "node:process";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { RoomServiceClient } = requireFromWeb("livekit-server-sdk");

const nodeId = process.env.CASTLINK_NODE_ID?.trim();
const nodeSecret = process.env.CASTLINK_NODE_SECRET?.trim();
const region = process.env.CASTLINK_NODE_REGION?.trim() || "unknown";
const nodeType = process.env.CASTLINK_NODE_TYPE?.trim() || "self-hosted";
const controlPlaneRaw = process.env.CASTLINK_CONTROL_PLANE_URL?.trim();
const livekitUrl = process.env.LIVEKIT_SERVER_URL?.trim() || "http://127.0.0.1:7880";
const apiKey = process.env.LIVEKIT_API_KEY?.trim();
const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

for (const [name, value] of Object.entries({
  CASTLINK_NODE_ID: nodeId,
  CASTLINK_NODE_SECRET: nodeSecret,
  CASTLINK_CONTROL_PLANE_URL: controlPlaneRaw,
  LIVEKIT_API_KEY: apiKey,
  LIVEKIT_API_SECRET: apiSecret,
})) {
  if (!value) throw new Error(`${name} is required`);
}
if (!["cloud", "self-hosted", "edge"].includes(nodeType)) throw new Error("CASTLINK_NODE_TYPE is invalid");

const controlPlane = new URL(controlPlaneRaw);
const localDev = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(controlPlane.hostname);
if (controlPlane.protocol !== "https:" && !localDev) throw new Error("Control plane must use HTTPS");

const livekit = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
const rooms = await livekit.listRooms();
const activeStudioIds = new Set();
let activeParticipants = 0;
let activeVideoTracks = 0;

for (const room of rooms) {
  let participants = [];
  try { participants = await livekit.listParticipants(room.name); } catch { continue; }
  if (!participants.length) continue;
  let roomHasScopedStudio = false;
  activeParticipants += participants.length;
  for (const participant of participants) {
    try {
      const metadata = JSON.parse(participant.metadata || "{}");
      if (metadata && typeof metadata.studioId === "string" && metadata.studioId) {
        activeStudioIds.add(metadata.studioId);
        roomHasScopedStudio = true;
      }
    } catch {}

    const tracks = Array.isArray(participant.tracks) ? participant.tracks : [];
    activeVideoTracks += tracks.filter(track => track?.type === 1).length;
  }
  if (!roomHasScopedStudio) activeStudioIds.add(`legacy-room:${room.name}`);
}

const activeStudios = activeStudioIds.size;
const cpus = os.cpus();
const load = os.loadavg()[0];
const cpuLoad = cpus.length ? Math.max(0, Math.min(1, load / cpus.length)) : 0;
const memoryLoad = Math.max(0, Math.min(1, 1 - os.freemem() / os.totalmem()));

const networkOutMbps = await sampleHostNetwork();
const payload = {
  schemaVersion: 1,
  nodeId,
  sentAt: Date.now(),
  region,
  nodeType,
  activeStudios,
  activeParticipants,
  activeVideoTracks,
  cpuLoad,
  memoryLoad,
  ...(networkOutMbps === null ? {} : {networkOutMbps}),
};

const body = JSON.stringify(payload);
const { createHmac } = await import("node:crypto");
const signature = createHmac("sha256", nodeSecret)
  .update("castlink-node-heartbeat-v1:")
  .update(body)
  .digest("base64url");

const response = await fetch(new URL("/v1/nodes/heartbeat", controlPlane), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-castlink-node-id": nodeId,
    "x-castlink-node-signature": signature,
  },
  body,
  cache: "no-store",
  signal: AbortSignal.timeout(Number(process.env.CASTLINK_CONTROL_PLANE_TIMEOUT_MS || 5000)),
});

if (!response.ok) {
  const data = await response.json().catch(() => ({}));
  throw new Error(typeof data.error === "string" ? data.error : `heartbeat failed (HTTP ${response.status})`);
}

if (process.env.CASTLINK_ENFORCE_NODE_ADMISSION === "1") {
  const {createHash}=await import("node:crypto"), path="/v1/control/node-admission", timestamp=String(Date.now());
  const command=JSON.stringify({action:"reconcile"});
  const proof=createHmac("sha256",nodeSecret).update("castlink-node-control-v1:").update(timestamp).update(":POST:").update(`${path}:${createHash("sha256").update(command).digest("hex")}`).digest("base64url");
  const applied=await fetch(new URL(path,controlPlane),{method:"POST",body:command,headers:{"content-type":"application/json","x-castlink-node-id":nodeId,"x-castlink-node-time":timestamp,"x-castlink-node-signature":proof},signal:AbortSignal.timeout(12000)});
  if(!applied.ok) console.error(JSON.stringify({event:"node.reconcile_pending",nodeId,status:applied.status}));
}

console.log(JSON.stringify({
  ok: true,
  nodeId,
  activeStudios,
  activeParticipants,
  activeVideoTracks,
}));
