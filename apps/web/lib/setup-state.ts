import { createHash, timingSafeEqual } from "node:crypto";
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

export async function completeSetup(input: { serverName: string; mode: "public" | "edge" }) {
  const next: SetupState = {
    schemaVersion: 1,
    completedAt: new Date().toISOString(),
    serverName: input.serverName.slice(0, 120),
    mode: input.mode,
  };
  await atomicWriteJson(file(), next);
  return next;
}
