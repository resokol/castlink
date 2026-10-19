'use strict';
const { isTrustedFrame } = require('./server-policy.cjs');

function createPermissionPolicy({ trustedOrigins, ask }) {
  const grants = new Set();
  let epoch = 0;
  function keys(request) {
    if (!isTrustedFrame({ ...request, trustedOrigins })) return [];
    const origin = new URL(request.frameUrl).origin;
    if (request.permission === 'media') {
      const types = request.mediaTypes;
      if (!Array.isArray(types) || types.some(t => !['audio', 'video'].includes(t))) return [];
      // Electron 44 requests display capture as media with an explicit empty array.
      // This key never authorizes microphone/camera; the native source picker still gates capture.
      if (!types.length) return [`${origin}:display-capture`];
      return [...new Set(types)].map(t => `${origin}:${t}`);
    }
    // Output device selection and fullscreen carry no microphone/camera grant.
    if (['speaker-selection', 'fullscreen', 'display-capture'].includes(request.permission)) return [`${origin}:${request.permission}`];
    return [];
  }
  function automatic(request) {
    return request.permission === 'clipboard-sanitized-write' && isTrustedFrame({ ...request, trustedOrigins });
  }
  return {
    check(request) {
      if (automatic(request)) return true;
      // Electron inventory checks omit mediaType (or use unknown). They ask whether
      // any input has consent, not whether a screen-capture grant exists.
      if (isTrustedFrame({ ...request, trustedOrigins })) {
        const origin = new URL(request.frameUrl).origin;
        const inputConsent = grants.has(`${origin}:audio`) || grants.has(`${origin}:video`);
        if (request.permission === 'media' && (!request.mediaTypes || request.mediaTypes.length === 1 && request.mediaTypes[0] === 'unknown')) return inputConsent;
        if (request.permission === 'speaker-selection' && grants.has(`${origin}:audio`)) return true;
      }
      const required = keys(request);
      return !!required.length && required.every(k => grants.has(k));
    },
    async request(request) {
      if (automatic(request)) return true;
      const required = keys(request), ticket = epoch;
      if (!required.length) return false;
      if (required.every(k => grants.has(k))) return true;
      if (!await ask(request) || epoch !== ticket) return false;
      required.forEach(k => grants.add(k));
      return true;
    },
    reset({ keepGrants = false } = {}) { epoch++; if (!keepGrants) grants.clear(); },
  };
}
module.exports = { createPermissionPolicy };
