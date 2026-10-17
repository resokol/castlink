import { createHash, randomBytes } from "node:crypto";
import { readAccess } from "./access";
import { atomicWriteJson, readJson, runtimeFile } from "./persistent-storage";

type InviteKeys = Record<string, { signed: string; expiresAt: number }>;
const file = () => runtimeFile("castlink-guest-invite-keys.json");
const digest = (key: string) => createHash("sha256").update(`castlink-guest-invite-v1:${key}`).digest("hex");
const queueKey = Symbol.for("castlink.guest-invite-key-write-queue");
const shared = globalThis as typeof globalThis & { [queueKey]?: Promise<unknown> };
async function read(): Promise<InviteKeys> {
  try {
    const value = await readJson(file());
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid guest invite key storage");
    return value as InviteKeys;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
/** Store the complete signed grant. The public key has 192 bits of independent entropy. */
export async function createGuestInviteKey(signed: string): Promise<string> {
  const claims = readAccess(signed);
  if (claims?.kind !== "invite") throw new Error("Invalid signed guest invite");
  const key = randomBytes(24).toString("base64url");
  const run = (shared[queueKey] || Promise.resolve()).then(async () => {
    const data = await read(), now = Date.now();
    for (const [id, entry] of Object.entries(data)) if (!entry || entry.expiresAt <= now) delete data[id];
    data[digest(key)] = { signed, expiresAt: claims.exp };
    await atomicWriteJson(file(), data);
  });
  shared[queueKey] = run.catch(() => undefined);
  await run;
  return key;
}
/** Legacy signed links use the same downstream signature, scope and version checks. */
export async function resolveGuestInviteKey(value: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(value)) return value.includes(".") ? value : "";
  await shared[queueKey];
  const entry = (await read())[digest(value)];
  if (!entry || typeof entry.signed !== "string" || entry.expiresAt <= Date.now()) return "";
  return readAccess(entry.signed)?.kind === "invite" ? entry.signed : "";
}
