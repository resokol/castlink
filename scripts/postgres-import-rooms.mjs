import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const pg = require("pg");

const replace = process.argv.includes("--replace");
const dataDir = path.resolve(process.env.STUDIOLINK_DATA_DIR || "");
const connectionString = process.env.DATABASE_URL?.trim();
const studioId = (process.env.STUDIOLINK_DEFAULT_STUDIO_ID || "studio-default").trim();
if (!/^[A-Za-z0-9._:-]{6,128}$/.test(studioId)) throw new Error("Invalid STUDIOLINK_DEFAULT_STUDIO_ID");

if (!process.env.STUDIOLINK_DATA_DIR?.trim()) throw new Error("STUDIOLINK_DATA_DIR is required");
if (!connectionString) throw new Error("DATABASE_URL is required");

const installationPath = path.join(dataDir, "installation.json");
const roomsPath = process.env.STUDIOLINK_ROOMS_FILE?.trim()
  ? path.resolve(process.env.STUDIOLINK_ROOMS_FILE)
  : path.join(dataDir, "runtime", "studiolink-rooms.json");

const installation = JSON.parse(await readFile(installationPath, "utf8"));
if (installation?.schemaVersion !== 1 || typeof installation.installationId !== "string") {
  throw new Error("Invalid installation.json");
}
const installationId = installation.installationId;
const expectedInstallationId = process.env.STUDIOLINK_INSTALLATION_ID?.trim();
if (expectedInstallationId && expectedInstallationId !== installationId) {
  throw new Error("STUDIOLINK_INSTALLATION_ID does not match installation.json");
}

const rawRooms = JSON.parse(await readFile(roomsPath, "utf8"));
const rooms = Array.isArray(rawRooms)
  ? rawRooms.map(room => typeof room === "string" ? { name: room } : room)
  : rawRooms?.schemaVersion === 1 && Array.isArray(rawRooms.rooms)
    ? rawRooms.rooms
    : null;
if (!rooms || rooms.some(room => !room || typeof room.name !== "string")) {
  throw new Error("Unsupported rooms JSON schema");
}

function canonical(room) {
  return {
    name: room.name,
    passwordHash: room.passwordHash || null,
    passwordCiphertext: room.passwordCiphertext || null,
    studioOnly: room.studioOnly === true,
    transferRoomId: room.transferRoomId || null,
    adminAccessVersion: room.adminAccessVersion || null,
    guestInviteVersion: room.guestInviteVersion || null,
    viewerAccessVersion: room.viewerAccessVersion || null,
    outputAccessVersion: room.outputAccessVersion || null,
  };
}

const source = rooms.map(canonical);
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: Number(process.env.CASTLINK_DB_CONNECT_TIMEOUT_MS || 3000),
  statement_timeout: Number(process.env.CASTLINK_DB_STATEMENT_TIMEOUT_MS || 10000),
  application_name: "castlink-room-import",
});

const client = await pool.connect();
try {
  await client.query("BEGIN");
  const migration = await client.query("SELECT version FROM castlink_schema_migrations WHERE version IN (1,2)");
  const versions = new Set(migration.rows.map(row => Number(row.version)));
  if (!versions.has(1) || !versions.has(2)) throw new Error("PostgreSQL schema migrations 1 and 2 are required");

  await client.query(
    "INSERT INTO castlink_installations (installation_id) VALUES ($1) ON CONFLICT (installation_id) DO NOTHING",
    [installationId],
  );
  await client.query(
    "SELECT installation_id FROM castlink_installations WHERE installation_id = $1 FOR UPDATE",
    [installationId],
  );

  const existingResult = await client.query(
    `SELECT name, password_hash, password_ciphertext, studio_only, transfer_room_id,
            admin_access_version, guest_invite_version, viewer_access_version, output_access_version
       FROM castlink_rooms
      WHERE installation_id = $1 AND studio_id = $2
      ORDER BY sort_order, name`,
    [installationId, studioId],
  );
  const existing = existingResult.rows.map(row => canonical({
    name: row.name,
    passwordHash: row.password_hash,
    passwordCiphertext: row.password_ciphertext,
    studioOnly: row.studio_only,
    transferRoomId: row.transfer_room_id,
    adminAccessVersion: row.admin_access_version,
    guestInviteVersion: row.guest_invite_version,
    viewerAccessVersion: row.viewer_access_version,
    outputAccessVersion: row.output_access_version,
  }));

  if (existing.length && JSON.stringify(existing) === JSON.stringify(source)) {
    await client.query("ROLLBACK");
    console.log(`no-op: PostgreSQL already contains the same ${source.length} rooms for ${installationId}/${studioId}`);
    process.exitCode = 0;
  } else {
    if (existing.length && !replace) {
      throw new Error("PostgreSQL already contains different rooms for this installation; rerun with --replace only after verifying backup");
    }

    await client.query("DELETE FROM castlink_rooms WHERE installation_id = $1 AND studio_id = $2", [installationId, studioId]);
    for (const [index, room] of source.entries()) {
      await client.query(
        `INSERT INTO castlink_rooms (
          installation_id, studio_id, name, password_hash, password_ciphertext, studio_only,
          transfer_room_id, admin_access_version, guest_invite_version,
          viewer_access_version, output_access_version, sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          installationId,
          studioId,
          room.name,
          room.passwordHash,
          room.passwordCiphertext,
          room.studioOnly,
          room.transferRoomId,
          room.adminAccessVersion,
          room.guestInviteVersion,
          room.viewerAccessVersion,
          room.outputAccessVersion,
          index,
        ],
      );
    }

    const verify = await client.query(
      "SELECT name FROM castlink_rooms WHERE installation_id = $1 AND studio_id = $2 ORDER BY sort_order, name",
      [installationId, studioId],
    );
    const importedNames = verify.rows.map(row => row.name);
    const sourceNames = source.map(room => room.name);
    if (JSON.stringify(importedNames) !== JSON.stringify(sourceNames)) {
      throw new Error("PostgreSQL room verification failed; transaction will be rolled back");
    }

    await client.query("COMMIT");
    console.log(`imported: ${source.length} rooms for ${installationId}/${studioId}`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
