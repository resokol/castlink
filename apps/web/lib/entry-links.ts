/** Invitation secrets live in memory and URL fragments, never in persistent settings. */
export type GuestInviteLink = { href: string; invite: string; room: string; studioId: string; personal: boolean };
export function parseGuestInviteUrl(value: string): GuestInviteLink | null {
  try {
    if (typeof value !== 'string' || value.length > 16384) return null;
    const url = new URL(value.trim());
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))) return null;
    if (!['/', '/room', '/join'].includes(url.pathname)) return null;
    const invite = new URLSearchParams(url.hash.slice(1)).get('invite') || url.searchParams.get('invite') || '';
    const room = url.searchParams.get('name') || url.searchParams.get('room') || '';
    const studioId = url.searchParams.get('studioId') || 'studio-default';
    const personal = url.pathname === '/join';
    if (!invite || invite.length > 4096 || (!personal && (!room.trim() || room.length > 100)) || !/^[a-zA-Z0-9_-]{1,128}$/.test(studioId)) return null;
    url.searchParams.delete('invite');
    url.searchParams.delete('mode');
    if (!personal) url.searchParams.set('mode', 'guest');
    url.hash = new URLSearchParams({invite}).toString();
    return { href: url.href, invite, room, studioId, personal };
  } catch { return null; }
}
export function nativeInviteUrl(value: string): string | null {
  const invite = parseGuestInviteUrl(value);
  if (!invite || invite.href.length > 8192 || new URL(invite.href).protocol !== 'https:') return null;
  const target = `castlink://join?url=${encodeURIComponent(invite.href)}`;
  return target.length <= 32768 ? target : null;
}
export function isCastLinkDesktop(userAgent: string, bridgePresent: boolean): boolean {
  return bridgePresent || /(?:^|\s)CastLinkDesktop\//.test(userAgent);
}

export function openNativeInvite(value: string, launch: (url:string)=>void): boolean {
  const target=nativeInviteUrl(value);if(!target)return false;
  try { launch(target);return true; } catch { return false; }
}
