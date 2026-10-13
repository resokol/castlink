import { atomicWriteJson, readJson, runtimeFile } from "./persistent-storage";

type RuntimeLicenseState = {
  schemaVersion: 1;
  lease?: string;
  offlineLicense?: string;
  activatedAt?: string;
};

const file = () => runtimeFile("castlink-license.json");

export async function readRuntimeLicenseState(): Promise<RuntimeLicenseState> {
  try {
    const value = await readJson(file()) as Partial<RuntimeLicenseState>;
    if (value.schemaVersion !== 1) throw new Error("Unsupported runtime license schema");
    return value as RuntimeLicenseState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1 };
    throw error;
  }
}

export async function writeRuntimeLicenseState(value: { lease: string; offlineLicense?: string }) {
  await atomicWriteJson(file(), {
    schemaVersion: 1,
    lease: value.lease,
    ...(value.offlineLicense ? { offlineLicense: value.offlineLicense } : {}),
    activatedAt: new Date().toISOString(),
  });
}
