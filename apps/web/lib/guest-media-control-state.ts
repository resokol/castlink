import type { GuestMediaSettingsCommand, GuestMediaSettingsState } from "./guest-media-control";

export type GuestMediaControlEntry = {
  touchedAt: number;
  state?: GuestMediaSettingsState;
  participantSid?: string;
  command?: GuestMediaSettingsCommand;
  result?: { id: string; ok: boolean; error?: string };
};
// Ephemeral live-session status, never an authorization source. Rejoining with
// the same token retains a pending route command; a new identity gets a new key.
const entries = new Map<string, GuestMediaControlEntry>();
export function guestMediaControlEntry(key: string): GuestMediaControlEntry {
  const now = Date.now();
  for (const [oldKey, value] of entries) if (value.touchedAt < now - 10 * 60_000) entries.delete(oldKey);
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
