import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import process from "node:process";

const requireFromWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const pg = requireFromWeb("pg");

const sourceUrl = process.env.DATABASE_URL?.trim();
const targetUrl = process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim() || sourceUrl;
const installationId = process.env.STUDIOLINK_INSTALLATION_ID?.trim();
const sourceStudioId = process.env.STUDIOLINK_DEFAULT_STUDIO_ID?.trim() || "studio-default";
const organizationId = process.env.CASTLINK_DEFAULT_ORGANIZATION_ID?.trim() || "org-default";
const studioId = process.env.CASTLINK_DEFAULT_STUDIO_ID?.trim() || "studio-default";
const accountId = process.env.CASTLINK_DEFAULT_ACCOUNT_ID?.trim() || "account-owner";
const nodeId = process.env.CASTLINK_NODE_ID?.trim() || "node-primary";
const nodeName = process.env.CASTLINK_NODE_NAME?.trim() || "Primary Node";
const deploymentModel = process.env.CASTLINK_DEPLOYMENT_MODEL?.trim() || "self-hosted";
if (!["self-hosted", "legacy"].includes(deploymentModel)) throw new Error("Unsupported deployment model");
const nodeType = deploymentModel === "legacy" ? "cloud" : "self-hosted";
const nodeRegion = process.env.CASTLINK_NODE_REGION?.trim() || "local";

if (!sourceUrl) throw new Error("DATABASE_URL is required");
if (!targetUrl) throw new Error("CASTLINK_CONTROL_PLANE_DATABASE_URL or DATABASE_URL is required");
if (!installationId || !/^[0-9a-f-]{36}$/i.test(installationId)) throw new Error("STUDIOLINK_INSTALLATION_ID must be a UUID");

for (const [name, value] of Object.entries({ organizationId, studioId, accountId, nodeId })) {
  if (!/^[A-Za-z0-9._:-]{6,128}$/.test(value)) throw new Error(`Invalid ${name}`);
}

function roomId(name) {
  return "room-" + createHash("sha256").update(`${organizationId}/${studioId}/${name}`).digest("hex").slice(0, 24);
}

const source = new pg.Pool({ connectionString: sourceUrl, max: 1, application_name: "castlink-control-seed-source" });
const target = targetUrl === sourceUrl ? source : new pg.Pool({ connectionString: targetUrl, max: 1, application_name: "castlink-control-seed-target" });

try {
  const migrations = await source.query("SELECT version FROM castlink_schema_migrations WHERE version IN (1,2)");
  const versions = new Set(migrations.rows.map(row => Number(row.version)));
  if (!versions.has(1) || !versions.has(2)) throw new Error("Node-local PostgreSQL migrations 1 and 2 are required");

  const schema = await target.query("SELECT to_regclass('castlink_control.studios') AS studios, to_regclass('castlink_control.rooms') AS rooms");
  if (!schema.rows[0]?.studios || !schema.rows[0]?.rooms) throw new Error("Control-plane schema is not applied");

  const currentRooms = await source.query(
    "SELECT name, studio_only FROM castlink_rooms WHERE installation_id=$1 AND studio_id=$2 ORDER BY sort_order,name",
    [installationId, sourceStudioId],
  );

  const client = await target.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO castlink_control.accounts(account_id, display_name)
       VALUES ($1,$2)
       ON CONFLICT (account_id) DO UPDATE SET display_name=EXCLUDED.display_name`,
      [accountId, "CastLink Owner"],
    );
    await client.query(
      `INSERT INTO castlink_control.organizations(organization_id,name)
       VALUES ($1,$2)
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId, "Default Organization"],
    );
    await client.query(
      `INSERT INTO castlink_control.organization_members(organization_id,account_id,role)
       VALUES ($1,$2,'owner')
       ON CONFLICT (organization_id,account_id) DO UPDATE SET role='owner'`,
      [organizationId, accountId],
    );
    await client.query(
      `INSERT INTO castlink_control.nodes(node_id,name,region,node_type,health,last_seen_at)
       VALUES ($1,$2,$3,$4,'unknown',NULL)
       ON CONFLICT (node_id) DO UPDATE SET name=EXCLUDED.name,region=EXCLUDED.region,updated_at=now()`,
      [nodeId, nodeName, nodeRegion, nodeType],
    );
    await client.query(
      `INSERT INTO castlink_control.studios(studio_id,organization_id,name,assignment_mode,assigned_node_id)
       VALUES ($1,$2,$3,'pinned',$4)
       ON CONFLICT (studio_id) DO UPDATE SET organization_id=EXCLUDED.organization_id,assigned_node_id=EXCLUDED.assigned_node_id,updated_at=now()`,
      [studioId, organizationId, "Default Studio", nodeId],
    );

    for (const room of currentRooms.rows) {
      await client.query(
        `INSERT INTO castlink_control.rooms(room_id,studio_id,name,settings)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (studio_id,name) DO UPDATE SET settings=EXCLUDED.settings,updated_at=now()`,
        [roomId(room.name), studioId, room.name, JSON.stringify({ studioOnly: room.studio_only === true })],
      );
    }

    await client.query("COMMIT");
    console.log(JSON.stringify({
      ok: true,
      organizationId,
      studioId,
      nodeId,
      importedRooms: currentRooms.rowCount || 0,
    }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
} finally {
  if (target !== source) await target.end();
  await source.end();
}
