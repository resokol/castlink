import { atomicWriteJson, getInstallationIdentity, readJson, runtimeFile } from "./persistent-storage";
import { createPostgresPool } from "./postgres-room-store";
import type { Pool } from "pg";

type Feature = "caster_slots" | "guest_admissions";
type Envelope = { schemaVersion: 1; scopes: Record<string, unknown> };
const sharedKey = Symbol.for("castlink.server-feature-storage");
const shared = globalThis as typeof globalThis & { [sharedKey]?: { queues: Map<string, Promise<unknown>>; pool?: Pool } };
const state: { queues: Map<string, Promise<unknown>>; pool?: Pool } = shared[sharedKey] ||= { queues: new Map() };
const file = (feature: Feature) => runtimeFile(`castlink-${feature}.json`);
async function envelope(feature: Feature): Promise<Envelope> {
  try {
    const value = await readJson(file(feature)) as Envelope;
    if (value?.schemaVersion !== 1 || !value.scopes || typeof value.scopes !== "object" || Array.isArray(value.scopes)) throw new Error("Invalid server feature storage");
    return value;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, scopes: {} }; throw error; }
}
const postgres = () => process.env.CASTLINK_STORAGE_BACKEND === "postgres";
const pool = () => state.pool ||= createPostgresPool();
export async function readServerFeatureState<T>(feature: Feature, scope: string, initial: () => T): Promise<T> {
  const { installationId } = await getInstallationIdentity();
  if (postgres()) {
    const result = await pool().query(`SELECT state FROM castlink_${feature} WHERE installation_id=$1 AND scope=$2`, [installationId, scope]);
    return result.rows.length ? result.rows[0].state as T : initial();
  }
  await state.queues.get(file(feature));
  const data = await envelope(feature), key = `${installationId}:${scope}`;
  return Object.hasOwn(data.scopes, key) ? data.scopes[key] as T : initial();
}
export async function updateServerFeatureState<T>(feature: Feature, scope: string, initial: () => T, change: (current: T) => T | Promise<T>): Promise<T> {
  const { installationId } = await getInstallationIdentity();
  if (postgres()) {
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO castlink_${feature}(installation_id,scope,state) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING`, [installationId, scope, JSON.stringify(initial())]);
      const result = await client.query(`SELECT state FROM castlink_${feature} WHERE installation_id=$1 AND scope=$2 FOR UPDATE`, [installationId, scope]);
      const next = await change(result.rows[0].state as T);
      await client.query(`UPDATE castlink_${feature} SET state=$3::jsonb WHERE installation_id=$1 AND scope=$2`, [installationId, scope, JSON.stringify(next)]);
      await client.query("COMMIT"); return next;
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
    finally { client.release(); }
  }
  const key = file(feature);
  const operation = (state.queues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    const data = await envelope(feature), scopeKey = `${installationId}:${scope}`;
    const next = await change(Object.hasOwn(data.scopes, scopeKey) ? data.scopes[scopeKey] as T : initial());
    data.scopes[scopeKey] = next; await atomicWriteJson(key, data); return next;
  });
  state.queues.set(key, operation.catch(() => {})); return operation;
}
