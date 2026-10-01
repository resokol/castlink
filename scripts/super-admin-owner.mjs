#!/usr/bin/env node
// Run only in the server console. No public HTTP bootstrap and no plaintext token in logs.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { Pool } = require("pg");
const { values } = parseArgs({ options: { origin: { type: "string" }, output: { type: "string" }, "revoke-all": { type: "boolean", default: false } } });
const connectionString = process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("A control-plane database connection is required");
if (!values.origin || !values.output || !path.isAbsolute(values.output)) throw new Error("Usage: --origin https://castlink.example --output /protected/new-invite.txt [--revoke-all]");
const origin = new URL(values.origin);
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Use a plain HTTPS origin without credentials or path");
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 10000 });
let file, client, committed = false;
try {
  file = await open(values.output, "wx", 0o600);
  client = await pool.connect();
  await client.query("BEGIN");
  const candidate = randomUUID();
  const result = await client.query(
    `INSERT INTO castlink_control.platform_access(access_key,access_version)
     VALUES ('super_admin_v2',$1) ON CONFLICT (access_key) DO UPDATE
     SET access_version=CASE WHEN $2 OR castlink_control.platform_access.access_version=''
       THEN EXCLUDED.access_version ELSE castlink_control.platform_access.access_version END, updated_at=now()
     RETURNING access_version`, [candidate, values["revoke-all"]]);
  const invite = `csa2.${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(invite).digest("hex");
  const expiresAt = Date.now() + 15 * 60_000;
  await client.query(
    `INSERT INTO castlink_control.platform_credentials(token_hash,kind,principal_id,access_version,expires_at)
     VALUES ($1,'invite',$2,$3,to_timestamp($4::double precision/1000))`,
    [hash, randomUUID(), result.rows[0].access_version, expiresAt]);
  const url = new URL("/super-admin", origin);
  url.hash = new URLSearchParams({ access: invite }).toString();
  await file.writeFile(url.toString() + "\n", "utf8");
  await file.sync();
  await client.query("COMMIT"); committed = true;
  console.log("Owner invitation saved to the requested protected file. Single use, expires in 15 minutes. Do not publish this file.");
} catch {
  await client?.query("ROLLBACK").catch(() => undefined);
  console.error("Could not issue owner access. Check the migration, database connection, and an unused writable output path.");
  process.exitCode = 1;
} finally {
  await file?.close();
  if (file && !committed) await unlink(values.output).catch(() => undefined);
  client?.release(); await pool.end();
}
