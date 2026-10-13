import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const pg = require("pg");

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required");

const migrationsDir = path.resolve(process.cwd(), "infrastructure/postgres");
const files = (await readdir(migrationsDir))
  .filter(name => /^\d+.*\.sql$/.test(name))
  .sort();

if (!files.length) throw new Error("No PostgreSQL migrations found");

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: Number(process.env.CASTLINK_DB_CONNECT_TIMEOUT_MS || 3000),
  statement_timeout: Number(process.env.CASTLINK_DB_STATEMENT_TIMEOUT_MS || 10000),
  application_name: "castlink-migrate",
});

try {
  for (const name of files) {
    const sql = await readFile(path.join(migrationsDir, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`applied: ${name}`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
