import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const storageSchemaVersion = 1;

export class PersistentDataError extends Error {
  constructor(message: string, readonly filePath: string, options?: { cause?: unknown }) {
    super(`${message}: ${filePath}`, options);
    this.name = "PersistentDataError";
  }
}

export function productionDataDir() {
  const configured = process.env.STUDIOLINK_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error("STUDIOLINK_DATA_DIR is required in production");
  }
  return path.resolve(process.cwd(), ".studiolink-data");
}

export function runtimeFile(name: string, override?: string) {
  return override?.trim() ? path.resolve(override) : path.join(productionDataDir(), "runtime", name);
}

export function persistentStatsDir() {
  const configured = process.env.STUDIOLINK_STATS_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(productionDataDir(), "stats");
}

export async function readJson(pathname: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw error;
    throw new PersistentDataError("Persistent JSON is unreadable or corrupt", pathname, { cause: error });
  }
}

export async function atomicWriteJson(pathname: string, value: unknown) {
  await mkdir(path.dirname(pathname), { recursive: true, mode: 0o700 });
  const temp = `${pathname}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
    await rename(temp, pathname);
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}

function validVersionedObject(value: unknown) {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    (value as { schemaVersion?: unknown }).schemaVersion === storageSchemaVersion;
}

async function validateOptionalJson(pathname: string, legacyAllowed: (value: unknown) => boolean) {
  try {
    const value = await readJson(pathname);
    if (!validVersionedObject(value) && !legacyAllowed(value)) {
      throw new PersistentDataError("Unsupported persistent data schema", pathname);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

type InstallationIdentity = { schemaVersion: 1; installationId: string; createdAt: string };

export async function ensureInstallationIdentity(root: string): Promise<InstallationIdentity> {
  const pathname = path.join(root, "installation.json");
  let identity: InstallationIdentity;
  try {
    const value = await readJson(pathname) as Partial<InstallationIdentity>;
    if (value.schemaVersion !== 1 || typeof value.installationId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.installationId) || typeof value.createdAt !== "string") {
      throw new PersistentDataError("Invalid installation identity", pathname);
    }
    identity = value as InstallationIdentity;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const configured = process.env.STUDIOLINK_INSTALLATION_ID?.trim();
    if (configured && !/^[0-9a-f-]{36}$/i.test(configured)) throw new Error("STUDIOLINK_INSTALLATION_ID must be a UUID");
    identity = { schemaVersion: 1, installationId: configured || randomUUID(), createdAt: new Date().toISOString() };
    await atomicWriteJson(pathname, identity);
  }
  const expected = process.env.STUDIOLINK_INSTALLATION_ID?.trim();
  if (expected && expected !== identity.installationId) throw new PersistentDataError("Installation identity does not match STUDIOLINK_INSTALLATION_ID", pathname);
  return identity;
}

export async function validatePersistentStorage() {
  const root = productionDataDir();
  const runtime = path.join(root, "runtime");
  const stats = persistentStatsDir();
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  await mkdir(stats, { recursive: true, mode: 0o700 });
  await access(root, constants.R_OK | constants.W_OK);
  await access(runtime, constants.R_OK | constants.W_OK);
  await access(stats, constants.R_OK | constants.W_OK);
  const installation = await ensureInstallationIdentity(root);

  await validateOptionalJson(runtimeFile("studiolink-rooms.json", process.env.STUDIOLINK_ROOMS_FILE), Array.isArray);
  await validateOptionalJson(runtimeFile("studiolink-moderator-access.json", process.env.STUDIOLINK_MODERATOR_ACCESS_FILE),
    value => !!value && typeof value === "object" && !Array.isArray(value));
  await validateOptionalJson(runtimeFile("studiolink-studio-control.json", process.env.STUDIOLINK_STUDIO_CONTROL_FILE),
    value => !!value && typeof value === "object" && !Array.isArray(value));

  return { root, runtime, stats, installationId: installation.installationId };
}


export async function getInstallationIdentity() {
  return ensureInstallationIdentity(productionDataDir());
}
