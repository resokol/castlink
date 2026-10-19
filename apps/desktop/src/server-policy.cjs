'use strict';

function parseServerInput(input, allowLoopback = false) {
  if (typeof input !== 'string' || input.length > 8192 || /[\\\u0000-\u0020]/.test(input.trim())) throw Error('Invalid server URL');
  const url = new URL(input.trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(allowLoopback && local && url.protocol === 'http:'))) throw Error('HTTPS required');
  return { origin: url.origin, launchUrl: url.href };
}
function parseLaunchInput(input, role = 'studio', allowLoopback = false) {
  if (!['studio', 'caster'].includes(role)) throw Error('Invalid role');
  const server = parseServerInput(input, allowLoopback);
  const url = new URL(server.launchUrl);
  // Full invitations, including personal caster links, retain their complete route and secret.
  if (role === 'caster' && url.pathname === '/' && !url.search && !url.hash) url.pathname = '/room';
  return { ...server, launchUrl: url.href };
}
function isTrustedFrame({ frameUrl, isMainFrame, trustedOrigins }) {
  if (!isMainFrame) return false;
  try { return trustedOrigins.has(new URL(frameUrl).origin); } catch { return false; }
}
function canNavigate(url, trustedOrigins) {
  return isTrustedFrame({ frameUrl: url, isMainFrame: true, trustedOrigins });
}
function settingsForDisk(server, reserveOrigins, locale) {
  if (!['ru', 'en', 'zh-CN'].includes(locale)) throw Error('Invalid locale');
  for (const origin of reserveOrigins) {
    if (parseServerInput(origin, true).origin !== origin) throw Error('Reserve must be an origin only');
  }
  return { serverOrigin: server.origin, reserveOrigins: [...new Set(reserveOrigins)], locale };
}
module.exports = { parseServerInput, parseLaunchInput, isTrustedFrame, canNavigate, settingsForDisk };
