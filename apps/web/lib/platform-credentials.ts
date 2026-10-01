import { createHash, randomBytes, randomUUID } from "node:crypto";
import { controlPlanePool, superAdminAccessVersion } from "./control-plane-store";

export const PLATFORM_INVITE_SECONDS = 15 * 60;
export const PLATFORM_SESSION_SECONDS = 12 * 60 * 60;
const key = "super_admin_v2";
const makeToken = () => `csa2.${randomBytes(32).toString("base64url")}`;
export function platformTokenHash(token: unknown): string | null {
  return typeof token === "string" && /^csa2\.[A-Za-z0-9_-]{43}$/.test(token)
    ? createHash("sha256").update(token).digest("hex") : null;
}

export async function issuePlatformInvite(issuedBy: string) {
  const version = await superAdminAccessVersion();
  const invite = makeToken(), principalId = randomUUID();
  const expiresAt = Date.now() + PLATFORM_INVITE_SECONDS * 1000;
  await controlPlanePool().query(
    `INSERT INTO castlink_control.platform_credentials
       (token_hash,kind,principal_id,issued_by,access_version,expires_at)
     VALUES ($1,'invite',$2,$3,$4,to_timestamp($5::double precision/1000))`,
    [platformTokenHash(invite), principalId, issuedBy, version, expiresAt]);
  return { invite, expiresAt };
}

/** Atomically consume a one-use invite; a studio cookie never enters this flow. */
export async function redeemPlatformInvite(invite: unknown) {
  const hash = platformTokenHash(invite);
  if (!hash) return null;
  const client = await controlPlanePool().connect();
  try {
    await client.query("BEGIN");
    const versionRow = await client.query<{ access_version: string }>(
      "SELECT access_version FROM castlink_control.platform_access WHERE access_key=$1 FOR SHARE", [key]);
    const version = versionRow.rows[0]?.access_version;
    const accepted = await client.query<{ principal_id: string }>(
      `UPDATE castlink_control.platform_credentials SET consumed_at=now()
        WHERE token_hash=$1 AND kind='invite' AND access_version=$2
          AND consumed_at IS NULL AND expires_at>now() RETURNING principal_id`, [hash, version || ""]);
    if (!version || !accepted.rowCount) { await client.query("ROLLBACK"); return null; }
    const token = makeToken(), principalId = accepted.rows[0].principal_id;
    const expiresAt = Date.now() + PLATFORM_SESSION_SECONDS * 1000;
    await client.query(
      `INSERT INTO castlink_control.platform_credentials
         (token_hash,kind,principal_id,access_version,expires_at)
       VALUES ($1,'session',$2,$3,to_timestamp($4::double precision/1000))`,
      [platformTokenHash(token), principalId, version, expiresAt]);
    await client.query("COMMIT");
    return { token, principalId, expiresAt };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined); throw error;
  } finally { client.release(); }
}

export async function readPlatformSession(token: unknown) {
  const hash = platformTokenHash(token);
  if (!hash) return null;
  const result = await controlPlanePool().query<{ principal_id: string; expires_at: Date }>(
    `SELECT c.principal_id,c.expires_at FROM castlink_control.platform_credentials c
       JOIN castlink_control.platform_access a ON a.access_key=$2 AND a.access_version=c.access_version
      WHERE c.token_hash=$1 AND c.kind='session' AND c.consumed_at IS NULL AND c.expires_at>now()`, [hash, key]);
  return result.rows[0] ? { principalId: result.rows[0].principal_id, expiresAt: new Date(result.rows[0].expires_at).getTime() } : null;
}
export async function revokePlatformSession(token: unknown) {
  const hash = platformTokenHash(token);
  if (hash) await controlPlanePool().query(
    "UPDATE castlink_control.platform_credentials SET consumed_at=now() WHERE token_hash=$1 AND kind='session'", [hash]);
}
