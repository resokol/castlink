import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
export type RoomRecord = {
  name: string;
  passwordHash?: string;
  passwordCiphertext?: string;
  studioOnly?: boolean;
  transferRoomId?: string;
  adminAccessVersion?: string;
  guestInviteVersion?: string;
  viewerAccessVersion?: string;
  outputAccessVersion?: string;
};
const file = () => process.env.STUDIOLINK_ROOMS_FILE || "/tmp/studiolink-rooms.json";
let pending: Promise<unknown> = Promise.resolve();
export async function readRooms(): Promise<RoomRecord[]> {
  try {
    const data = JSON.parse(await readFile(file(), "utf8"));
    return data.map((r: string | RoomRecord) => typeof r === "string" ? { name: r } : r).filter((r: RoomRecord) => typeof r.name === "string");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [{ name: "demo-room" }];
    throw error;
  }
}
export function updateRooms(change: (rooms: RoomRecord[]) => RoomRecord[]) {
  const operation = pending.catch(() => undefined).then(async () => {
    const rooms = change(await readRooms());
    await mkdir(path.dirname(file()), { recursive: true });
    await writeFile(file() + ".new", JSON.stringify(rooms), { mode: 0o600 });
    await rename(file() + ".new", file());
    return rooms;
  });
  pending = operation;
  return operation;
}

export async function ensureRoomAccessVersions(name: string): Promise<RoomRecord | undefined> {
  let ensured: RoomRecord | undefined;
  await updateRooms(rooms => rooms.map(room => {
    if (room.name !== name) return room;
    // Existing 0.9 links were versioned from the room password hash. Bootstrap
    // to the same value so an upgrade does not silently break active vMix/output
    // and invitation links; the first explicit revoke/password change rotates
    // each scope to a random independent version.
    const legacyVersion = createHash("sha256").update(room.passwordHash || "").digest("hex");
    const next = {
      ...room,
      guestInviteVersion: room.guestInviteVersion || legacyVersion,
      viewerAccessVersion: room.viewerAccessVersion || legacyVersion,
      outputAccessVersion: room.outputAccessVersion || legacyVersion,
    };
    ensured = next;
    return next;
  }));
  return ensured;
}
