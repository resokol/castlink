import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const runtime = process.env.CASTLINK_TEST_PWSH || 'pwsh';
const available = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
const fixture = fileURLToPath(new URL('./server-windows.test.ps1', import.meta.url));
const installer = fileURLToPath(new URL('../install-server-windows.ps1', import.meta.url));

test('Windows installer PowerShell behavioral fixtures', { skip: process.platform !== 'win32' ? 'Windows behavior requires the actual Windows job' : available.error?.code === 'ENOENT' ? 'PowerShell unavailable; set CASTLINK_TEST_PWSH to run' : false }, () => {
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

test('native compiler wrapper fixes the Windows Framework host independently of caller edition', () => {
  const source=readFileSync(installer,'utf8');
  const body=source.slice(source.indexOf('function Build-CastlinkNativePanelHost('),source.indexOf('function Assert-CastlinkNativePanelReceipt('));
  assert.match(body,/System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/);
  assert.match(body,/-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File/);
  assert.match(body,/\$LASTEXITCODE -ne 0/);
  assert.doesNotMatch(body,/& \(Join-Path \$Directory/);
});

test('failed native panel preparation cannot offer or register a fallback logon task', () => {
  const source=readFileSync(installer,'utf8');
  const start=source.indexOf('$panelReady = $null; $panelFailure = $null');
  const end=source.indexOf("$state.phase = 'ready'",start);
  assert.ok(start>=0&&end>start,'Expected interactive install completion block');
  const completion=source.slice(start,end);
  assert.match(completion,/if \(-not \$panelFailure -and -not \$state\.PSObject\.Properties\['autoStartAtLogon'\]\)/);
  assert.ok(completion.indexOf('if (-not $panelFailure')<completion.indexOf("Read-Host 'Start this CastLink server"));
  assert.ok(completion.includes('Register-CastlinkLogonTask'));
});
