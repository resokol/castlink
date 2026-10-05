import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, readJson, runtimeFile } from "./persistent-storage";

type SetupState = {
  schemaVersion: 1;
  completedAt?: string;
  serverName?: string;
  mode?: "public" | "edge";
};

const file = () => runtimeFile("castlink-setup.json");

export async function readSetupState(): Promise<SetupState> {
  try {
    const value = await readJson(file()) as Partial<SetupState>;
    if (value.schemaVersion !== 1) throw new Error("Unsupported setup state schema");
    return value as SetupState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1 };
    throw error;
  }
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function validSetupToken(value: string | undefined) {
  const expected = process.env.CASTLINK_SETUP_TOKEN?.trim();
  if (!expected || !value) return false;
  const a = digest(expected), b = digest(value);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setupRequired() {
  return !(await readSetupState()).completedAt;
}

export class SetupConflictError extends Error {
  constructor() { super("Первичная настройка завершена или заблокирована другой операцией"); }
}

// The lock is never recovered automatically: after a crash the operator must inspect it.
export async function completeSetup(input: { serverName: string; mode: "public" | "edge" }, beforeComplete?: () => Promise<unknown>) {
  const lockPath = runtimeFile("castlink-setup.lock");
  await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new SetupConflictError();
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ schemaVersion: 1, pid: process.pid }));
    if (!(await setupRequired())) throw new SetupConflictError();
    await beforeComplete?.();
    const next: SetupState = {
      schemaVersion: 1,
      completedAt: new Date().toISOString(),
      serverName: input.serverName.slice(0, 120),
      mode: input.mode,
    };
    await atomicWriteJson(file(), next);
    return next;
  } finally {
    await lock.close();
    await rm(lockPath);
  }
}
