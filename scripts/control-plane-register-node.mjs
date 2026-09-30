import { createRequire } from "node:module";
import process from "node:process";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const pg = requireFromWeb("pg");

const connectionString = process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("CASTLINK_CONTROL_PLANE_DATABASE_URL or DATABASE_URL is required");

const nodeId = process.env.CASTLINK_REGISTER_NODE_ID?.trim() || "";
const name = process.env.CASTLINK_REGISTER_NODE_NAME?.trim() || "";
const region = process.env.CASTLINK_REGISTER_NODE_REGION?.trim() || "";
const nodeType = process.env.CASTLINK_REGISTER_NODE_TYPE?.trim() || "cloud";
const endpointRaw = process.env.CASTLINK_REGISTER_NODE_ENDPOINT?.trim() || "";
const maxActiveStudios = Number(process.env.CASTLINK_REGISTER_MAX_STUDIOS || 4);
const maxParticipants = Number(process.env.CASTLINK_REGISTER_MAX_PARTICIPANTS || 24);
const maxVideoTracks = Number(process.env.CASTLINK_REGISTER_MAX_VIDEO_TRACKS || 32);

if (!/^[A-Za-z0-9._:-]{8,128}$/.test(nodeId)) throw new Error("Invalid CASTLINK_REGISTER_NODE_ID");
if (!name || name.length > 120) throw new Error("Invalid CASTLINK_REGISTER_NODE_NAME");
if (!region || region.length > 80) throw new Error("Invalid CASTLINK_REGISTER_NODE_REGION");
if (!["cloud","self-hosted","edge"].includes(nodeType)) throw new Error("Invalid CASTLINK_REGISTER_NODE_TYPE");
for (const [key, value] of Object.entries({ maxActiveStudios, maxParticipants, maxVideoTracks })) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10000) throw new Error(`Invalid ${key}`);
}

const endpoint = new URL(endpointRaw);
const localDev = ["localhost","127.0.0.1"].includes(endpoint.hostname);
if (endpoint.protocol !== "https:" && !localDev) throw new Error("Node endpoint must use HTTPS");

const pool = new pg.Pool({ connectionString, max: 1, application_name: "castlink-register-node" });
try {
  const schema = await pool.query("SELECT to_regclass('castlink_control.nodes') AS nodes");
  if (!schema.rows[0]?.nodes) throw new Error("Control-plane schema is not applied");

  const result = await pool.query(
    `INSERT INTO castlink_control.nodes(
       node_id,name,region,node_type,endpoint,state,health,
       max_active_studios,max_participants,max_video_tracks
     ) VALUES($1,$2,$3,$4,$5,'active','unknown',$6,$7,$8)
     ON CONFLICT(node_id) DO UPDATE SET
       name=EXCLUDED.name,
       region=EXCLUDED.region,
       node_type=EXCLUDED.node_type,
       endpoint=EXCLUDED.endpoint,
       max_active_studios=EXCLUDED.max_active_studios,
       max_participants=EXCLUDED.max_participants,
       max_video_tracks=EXCLUDED.max_video_tracks,
       updated_at=now()
     RETURNING node_id,name,region,node_type,endpoint,state,health,
               max_active_studios,max_participants,max_video_tracks`,
    [nodeId, name, region, nodeType, endpoint.origin, maxActiveStudios, maxParticipants, maxVideoTracks],
  );

  console.log(JSON.stringify({ ok: true, node: result.rows[0] }));
} finally {
  await pool.end();
}
