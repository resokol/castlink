import {seedDefaultTransaction} from "./control-plane-seed-transaction.mjs";
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

    await seedDefaultTransaction(client,{organizationId,studioId,accountId,nodeId,nodeName,nodeType,nodeRegion},currentRooms);

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
