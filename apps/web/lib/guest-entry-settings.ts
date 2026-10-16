export type GuestEntrySettings = { noGuestAudio: boolean; startMuted: boolean; audioOnly: boolean };
export const defaultGuestEntrySettings: GuestEntrySettings = { noGuestAudio: false, startMuted: false, audioOnly: false };
export function guestEntrySettings(value: unknown): GuestEntrySettings {
  if (value === undefined) return { ...defaultGuestEntrySettings };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid entry settings');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !['noGuestAudio', 'startMuted', 'audioOnly'].includes(key)) || Object.values(record).some(v => typeof v !== 'boolean')) throw Error('Invalid entry settings');
  return { ...defaultGuestEntrySettings, ...record };
}
export function guestAudioSubscriptionPermissions(participants: Iterable<{ identity: string; metadata?: string }>, videoTrackSids: string[]) {
  return Array.from(participants, p => {
    let restricted = false;
    try { const data = JSON.parse(p.metadata || '{}'); restricted = data.role === 'guest' && data.entrySettings?.noGuestAudio === true; } catch { restricted = p.identity.startsWith('guest-'); }
    return { participantIdentity: p.identity, allowAll: !restricted, allowedTrackSids: restricted ? videoTrackSids : [] };
  });
}

export function guestEntryDevices(settings?: GuestEntrySettings, choices?: { audioEnabled?: boolean; videoEnabled?: boolean }) {
 return { audioEnabled: choices?.audioEnabled !== false && !settings?.startMuted, videoEnabled: choices?.videoEnabled !== false && !settings?.audioOnly };
}
