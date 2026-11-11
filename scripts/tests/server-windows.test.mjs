import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runtime = process.env.CASTLINK_TEST_PWSH || 'pwsh';
const available = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
const fixture = fileURLToPath(new URL('./server-windows.test.ps1', import.meta.url));
const installer = fileURLToPath(new URL('../install-server-windows.ps1', import.meta.url));

test('Windows installer PowerShell behavioral fixtures', { skip: available.error?.code === 'ENOENT' ? 'PowerShell unavailable; set CASTLINK_TEST_PWSH to run' : false }, () => {
  assert.equal(available.status, 0, available.stderr);
  const result = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-File', fixture], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS: server Windows installer behavioral fixtures/);
});

test('Unpinned source supports help without Windows side effects', { skip: available.error?.code === 'ENOENT' ? 'PowerShell unavailable; set CASTLINK_TEST_PWSH to run' : false }, () => {
  const result = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-File', installer, '-Help'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Windows 11 x64/);
  assert.match(result.stdout, /no Docker/);
});
