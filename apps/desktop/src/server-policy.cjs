'use strict';

function parseServerInput(input, allowLoopback = false) {
  if (typeof input !== 'string' || input.length > 8192 || /[\\\u0000-\u0020]/.test(input.trim())) throw Error('Invalid server URL');
  const url = new URL(input.trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(allowLoopback && local && url.protocol === 'http:'))) throw Error('HTTPS required');
  return { origin: url.origin, launchUrl: url.href };
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
module.exports = { parseServerInput, isTrustedFrame, canNavigate, settingsForDisk };
