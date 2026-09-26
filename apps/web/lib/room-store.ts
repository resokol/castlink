import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
export type RoomRecord = { name: string; passwordHash?: string; studioOnly?: boolean };
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
