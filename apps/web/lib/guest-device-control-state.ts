import type { GuestDeviceRequest, GuestDeviceResult, GuestDeviceState } from "./guest-device-control";
export type GuestDeviceEntry = { touchedAt: number; stateAt?: number; participantSid?: string; state?: GuestDeviceState; request?: GuestDeviceRequest; result?: GuestDeviceResult };
const entries = new Map<string, GuestDeviceEntry>();
/** Status cache only; every API operation independently checks room and participant authority. */
export function guestDeviceEntry(key: string): GuestDeviceEntry {
  const now = Date.now();
  for (const [oldKey, entry] of entries) if (entry.touchedAt < now - 600_000) entries.delete(oldKey);
  let entry = entries.get(key);
  if (!entry) {
    if (entries.size >= 2048) {
      const oldest = Array.from(entries).sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
      if (oldest) entries.delete(oldest[0]);
    }
    entry = { touchedAt: now }; entries.set(key, entry);
  }
  entry.touchedAt = now;
  return entry;
}
