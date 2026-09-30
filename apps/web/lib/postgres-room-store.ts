import { Pool, type PoolClient } from "pg";
import type { RoomMutation, RoomRecord, RoomStoreBackend } from "./room-store";

type RoomRow = {
  name: string;
  password_hash: string | null;
  password_ciphertext: string | null;
  studio_only: boolean;
  transfer_room_id: string | null;
  admin_access_version: string | null;
  guest_invite_version: string | null;
  viewer_access_version: string | null;
  output_access_version: string | null;
  sort_order: number;
};

function optional(value: string | null) {
  return value === null ? undefined : value;
}

export function roomRecordFromRow(row: RoomRow): RoomRecord {
  return {
    name: row.name,
    passwordHash: optional(row.password_hash),
    passwordCiphertext: optional(row.password_ciphertext),
    studioOnly: row.studio_only || undefined,
    transferRoomId: optional(row.transfer_room_id),
    adminAccessVersion: optional(row.admin_access_version),
    guestInviteVersion: optional(row.guest_invite_version),
    viewerAccessVersion: optional(row.viewer_access_version),
    outputAccessVersion: optional(row.output_access_version),
  };
}

function requireUuid(value: string | undefined, name: string) {
  const clean = value?.trim();
  if (!clean || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)) {
    throw new Error(`${name} must be a UUID`);
  }
  return clean;
}

export function createPostgresPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString?.trim()) throw new Error("DATABASE_URL is required when CASTLINK_STORAGE_BACKEND=postgres");
  return new Pool({
    connectionString,
    max: Number(process.env.CASTLINK_DB_POOL_MAX || 5),
    connectionTimeoutMillis: Number(process.env.CASTLINK_DB_CONNECT_TIMEOUT_MS || 3000),
    idleTimeoutMillis: Number(process.env.CASTLINK_DB_IDLE_TIMEOUT_MS || 30000),
    statement_timeout: Number(process.env.CASTLINK_DB_STATEMENT_TIMEOUT_MS || 5000),
    application_name: "castlink-web",
  });
}

export class PostgresRoomStoreBackend implements RoomStoreBackend {
  constructor(
    private readonly pool: Pool,
    private readonly installationId = requireUuid(process.env.STUDIOLINK_INSTALLATION_ID, "STUDIOLINK_INSTALLATION_ID"),
  ) {}

  async validate() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.ensureInstallation(client);
      const migration = await client.query<{ version: number }>(
        "SELECT version FROM castlink_schema_migrations WHERE version = 1",
      );
      if (!migration.rowCount) throw new Error("PostgreSQL schema migration 1 is not applied");
      const count = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM castlink_rooms WHERE installation_id = $1",
        [this.installationId],
      );
      if (Number(count.rows[0]?.count || 0) < 1) {
        throw new Error("PostgreSQL room store is empty; import rooms before enabling it");
      }
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async read(): Promise<RoomRecord[]> {
    const result = await this.pool.query<RoomRow>(
      `SELECT name, password_hash, password_ciphertext, studio_only, transfer_room_id,
              admin_access_version, guest_invite_version, viewer_access_version, output_access_version, sort_order
         FROM castlink_rooms
        WHERE installation_id = $1
        ORDER BY sort_order, name`,
      [this.installationId],
    );
    return result.rows.map(roomRecordFromRow);
  }

  async update(change: RoomMutation): Promise<RoomRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.ensureInstallation(client);
      await client.query(
        "SELECT installation_id FROM castlink_installations WHERE installation_id = $1 FOR UPDATE",
        [this.installationId],
      );

      const currentResult = await client.query<RoomRow>(
        `SELECT name, password_hash, password_ciphertext, studio_only, transfer_room_id,
                admin_access_version, guest_invite_version, viewer_access_version, output_access_version, sort_order
           FROM castlink_rooms
          WHERE installation_id = $1
          ORDER BY sort_order, name
          FOR UPDATE`,
        [this.installationId],
      );
      const current = currentResult.rows.map(roomRecordFromRow);
      const next = change(current);

      await client.query("DELETE FROM castlink_rooms WHERE installation_id = $1", [this.installationId]);
      for (const [index, room] of next.entries()) await this.insertRoom(client, room, index);

      await client.query("COMMIT");
      return next;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async ensureInstallation(client: PoolClient) {
    await client.query(
      `INSERT INTO castlink_installations (installation_id)
       VALUES ($1)
       ON CONFLICT (installation_id) DO NOTHING`,
      [this.installationId],
    );
  }

  private async insertRoom(client: PoolClient, room: RoomRecord, sortOrder: number) {
    await client.query(
      `INSERT INTO castlink_rooms (
         installation_id, name, password_hash, password_ciphertext, studio_only,
         transfer_room_id, admin_access_version, guest_invite_version,
         viewer_access_version, output_access_version, updated_at, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11)`,
      [
        this.installationId,
        room.name,
        room.passwordHash ?? null,
        room.passwordCiphertext ?? null,
        room.studioOnly === true,
        room.transferRoomId ?? null,
        room.adminAccessVersion ?? null,
        room.guestInviteVersion ?? null,
        room.viewerAccessVersion ?? null,
        room.outputAccessVersion ?? null,
        sortOrder,
      ],
    );
  }
}
