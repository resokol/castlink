'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMacInputPermissions } = require('../src/macos-input-permissions.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-input-permissions-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'remote-input'));
  const executable = path.join(directory, 'remote-input', 'CastLink.RemoteInput');
  fs.writeFileSync(executable, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  return { directory, executable };
}
const payload = (inputMonitoring = false) => JSON.stringify({ screen: true, accessibility: true, inputMonitoring });

test('status probes only the fixed packaged helper with a bounded non-prompting command', t => {
  const { directory, executable } = fixture(t);
  const calls = [];
  let monitored = false;
  const permissions = createMacInputPermissions({ resourcesPath: directory, platform: 'darwin',
    execFileSync(file, args, options) { calls.push({ file, args, options }); return payload(monitored); },
    execFile() { assert.fail('status cannot request Input Monitoring'); },
  });
  assert.deepEqual(calls, []);
  assert.deepEqual(permissions.probe(), { screen: true, accessibility: true, inputMonitoring: false });
  assert.equal(permissions.status(), false);
  monitored = true;
  assert.equal(permissions.status(), true);
  for (const call of calls) {
    assert.equal(call.file, executable);
    assert.deepEqual(call.args, ['--permission-status']);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.timeout, 1500);
    assert.equal(call.options.killSignal, 'SIGKILL');
    assert.equal(call.options.maxBuffer, 4096);
  }
});

test('explicit requests use the fixed bounded request command and native post-request preflight', async t => {
  const { directory, executable } = fixture(t);
  const permissions = createMacInputPermissions({ resourcesPath: directory, platform: 'darwin',
    execFile(file, args, options, callback) {
      assert.equal(file, executable);
      assert.deepEqual(args, ['--request-input-monitoring']);
      assert.equal(options.shell, false);
      assert.equal(options.timeout, 10000);
      assert.equal(options.killSignal, 'SIGKILL');
      assert.equal(options.maxBuffer, 4096);
      callback(null, payload(false));
    },
  });
  assert.equal(await permissions.request({ executable: '/tmp/other', flag: '--inject' }), false);
});

test('malformed or oversized native responses cannot grant monitoring', async t => {
  const { directory } = fixture(t);
  for (const value of ['', 'true', 'null', '[]', '{}', '{"inputMonitoring":true}',
    JSON.stringify({ screen: true, accessibility: true, inputMonitoring: 'true' }),
    ' '.repeat(4097) + payload(true)]) {
    const permissions = createMacInputPermissions({ resourcesPath: directory, platform: 'darwin',
      execFileSync: () => value, execFile: (file, args, options, callback) => callback(null, value),
    });
    assert.equal(permissions.probe(), null);
    assert.equal(permissions.status(), undefined);
    assert.equal(await permissions.request(), undefined);
  }
});

test('native failure and timeout remain unavailable, ignoring even apparently successful stdout', async t => {
  const { directory } = fixture(t);
  const permissions = createMacInputPermissions({ resourcesPath: directory, platform: 'darwin',
    execFileSync() { throw Object.assign(new Error('private'), { code: 'ETIMEDOUT' }); },
    execFile(file, args, options, callback) { callback(new Error('private'), payload(true)); },
  });
  assert.equal(permissions.probe(), null);
  assert.equal(permissions.status(), undefined);
  assert.equal(await permissions.request(), undefined);
  const throws = createMacInputPermissions({ resourcesPath: directory, platform: 'darwin',
    execFile() { throw new Error('private'); },
  });
  assert.equal(await throws.request(), undefined);
});

test('non-macOS, missing, non-executable and symlink resources never execute', async t => {
  const { directory, executable } = fixture(t);
  const options = { resourcesPath: directory, platform: 'darwin',
    execFileSync() { assert.fail('unavailable helper'); }, execFile() { assert.fail('unavailable helper'); },
  };
  const otherPlatform = createMacInputPermissions({ ...options, platform: 'win32' });
  assert.equal(otherPlatform.status(), undefined);
  assert.equal(await otherPlatform.request(), undefined);
  fs.chmodSync(executable, 0o644);
  assert.equal(createMacInputPermissions(options).probe(), null);
  fs.unlinkSync(executable);
  assert.equal(await createMacInputPermissions(options).request(), undefined);
  const target = path.join(directory, 'other');
  fs.writeFileSync(target, '', { mode: 0o755 });
  fs.symlinkSync(target, executable);
  assert.equal(createMacInputPermissions(options).probe(), null);
});

test('relative and malformed resource roots are rejected', () => {
  for (const resourcesPath of [undefined, null, {}, '', 'relative', '/tmp/\0bad']) {
    assert.throws(() => createMacInputPermissions({ resourcesPath }), TypeError);
  }
});
