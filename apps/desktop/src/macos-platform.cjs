'use strict';

const KINDS = new Set(['microphone', 'camera', 'screen', 'accessibility', 'input-monitoring', 'automation']);
const MEDIA_STATUSES = new Set(['granted', 'denied', 'restricted', 'not-determined', 'unknown']);
const SETTINGS = Object.freeze({
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  'input-monitoring': 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
});

function assertKind(kind) {
  if (!KINDS.has(kind)) throw new TypeError('Unsupported macOS permission kind');
}

function denied(kind, reason) { return { granted: false, reason: `${kind}-${reason}` }; }
function granted() { return { granted: true, reason: null }; }

// OS permission only: callers still own origin/role consent, source selection,
// and a lifecycle ticket around every await. A pending TCC prompt cannot be
// cancelled; its eventual approval must not revive a closed/replaced session.
function createMacPermissionAdapter({ systemPreferences = {}, openSettings, inputMonitoring = {} } = {}) {
  function status(kind) {
    assertKind(kind);
    // Automation consent is per target application and operation. Electron has
    // no general query API; native presentation helpers must verify their own
    // bounded Apple Event operation instead of treating Accessibility as proof.
    if (kind === 'automation') return denied(kind, 'target-required');
    try {
      if (kind === 'input-monitoring') {
        if (typeof inputMonitoring.status !== 'function') return denied(kind, 'api-unavailable');
        const value = inputMonitoring.status();
        return value === true ? granted() : denied(kind, value === false ? 'denied' : 'unknown');
      }
      if (kind === 'accessibility') {
        if (typeof systemPreferences.isTrustedAccessibilityClient !== 'function') return denied(kind, 'api-unavailable');
        return systemPreferences.isTrustedAccessibilityClient(false) === true ? granted() : denied(kind, 'denied');
      }
      if (typeof systemPreferences.getMediaAccessStatus !== 'function') return denied(kind, 'api-unavailable');
      const value = systemPreferences.getMediaAccessStatus(kind);
      if (value === 'granted') return granted();
      return denied(kind, MEDIA_STATUSES.has(value) ? value : 'unknown');
    } catch {
      return denied(kind, 'status-failed');
    }
  }

  async function settings(kind, current) {
    if (typeof openSettings !== 'function') return denied(kind, 'settings-unavailable');
    try {
      // Never forward a renderer-supplied URL or target into the OS settings app.
      await openSettings(SETTINGS[kind]);
      return current;
    } catch {
      return denied(kind, 'settings-failed');
    }
  }

  async function request(kind) {
    assertKind(kind);
    const current = status(kind);
    if (current.granted) return current;
    if (kind === 'automation') return settings(kind, current);
    if (kind === 'input-monitoring') {
      // Input Monitoring is distinct from Accessibility. A native request only
      // comes from an explicit user action; neither launch nor status prompts.
      if (typeof inputMonitoring.request === 'function') {
        try { await inputMonitoring.request(); } catch { return denied(kind, 'request-failed'); }
        const checked = status(kind);
        if (checked.granted) return checked;
        return settings(kind, checked);
      }
      return settings(kind, current);
    }
    if (current.reason === `${kind}-api-unavailable` || current.reason === `${kind}-status-failed`) return current;
    if (kind === 'screen') {
      // askForMediaAccess accepts only microphone/camera. Opening Screen
      // Recording settings is guidance, never proof of permission or capture.
      return settings(kind, current);
    }
    if (kind === 'accessibility') {
      try {
        return systemPreferences.isTrustedAccessibilityClient(true) === true ? granted() : denied(kind, 'denied');
      } catch {
        return denied(kind, 'request-failed');
      }
    }
    if (current.reason === `${kind}-denied`) return settings(kind, current);
    if (current.reason !== `${kind}-not-determined`) return current;
    if (typeof systemPreferences.askForMediaAccess !== 'function') return denied(kind, 'api-unavailable');
    try {
      return await systemPreferences.askForMediaAccess(kind) === true ? granted() : denied(kind, 'denied');
    } catch {
      return denied(kind, 'request-failed');
    }
  }

  return { status, request };
}

module.exports = { createMacPermissionAdapter };
