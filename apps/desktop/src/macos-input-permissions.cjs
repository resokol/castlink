'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: executeFileSync, execFile: executeFile } = require('node:child_process');
const MAX_OUTPUT = 4096;

function parseStatus(stdout) {
  if (typeof stdout !== 'string' || Buffer.byteLength(stdout, 'utf8') > MAX_OUTPUT) return null;
  try {
    const value = JSON.parse(stdout);
    if (!value || Array.isArray(value) || typeof value !== 'object' ||
        ['screen', 'accessibility', 'inputMonitoring'].some(key => typeof value[key] !== 'boolean')) return null;
    return { screen: value.screen, accessibility: value.accessibility, inputMonitoring: value.inputMonitoring };
  } catch { return null; }
}

// Main-process only: the resource root is supplied by the app, never IPC. The
// helper's permission-only modes do not construct an event tap or send input.
function createMacInputPermissions({ resourcesPath, platform = process.platform,
  execFileSync = executeFileSync, execFile = executeFile } = {}) {
  if (typeof resourcesPath !== 'string' || !path.isAbsolute(resourcesPath) || resourcesPath.includes('\0')) {
    throw new TypeError('An absolute native resource path is required');
  }
  const executable = path.join(resourcesPath, 'remote-input', 'CastLink.RemoteInput');
  function available() {
    if (platform !== 'darwin') return false;
    try { const stat = fs.lstatSync(executable); return stat.isFile() && (stat.mode & 0o111) !== 0; }
    catch { return false; }
  }
  function probe() {
    if (!available()) return null;
    try {
      return parseStatus(execFileSync(executable, ['--permission-status'], {
        shell: false, encoding: 'utf8', timeout: 1500, killSignal: 'SIGKILL', maxBuffer: MAX_OUTPUT,
        stdio: ['ignore', 'pipe', 'pipe'],
      }));
    } catch { return null; }
  }
  return {
    probe,
    status() { return probe()?.inputMonitoring; },
    async request() {
      if (!available()) return undefined;
      return new Promise(resolve => {
        try {
          execFile(executable, ['--request-input-monitoring'], {
            shell: false, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: MAX_OUTPUT,
          }, (error, stdout) => {
            // Native output is a fresh preflight after its explicit request.
            resolve(error ? undefined : parseStatus(stdout)?.inputMonitoring);
          });
        } catch { resolve(undefined); }
      });
    },
  };
}

module.exports = { createMacInputPermissions };
