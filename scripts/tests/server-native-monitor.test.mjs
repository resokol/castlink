import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bridge = fileURLToPath(new URL('../server-native-monitor.ps1', import.meta.url));
const fixture = fileURLToPath(new URL('./server-native-monitor.fixtures.ps1', import.meta.url));
const runtime = process.env.CASTLINK_TEST_PWSH || 'pwsh';
const available = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });

test('native monitor security boundary has no browser, Node or TLS bypass', () => {
  const source = fs.readFileSync(bridge, 'utf8');
  for (const name of ['Read-CastlinkNativeMonitorBinding', 'Get-CastlinkNativeMonitorSnapshot', 'Export-CastlinkNativeMonitorBundle']) assert.match(source, new RegExp(`function ${name}`));
  assert.doesNotMatch(source, /ServerCertificateValidationCallback|SkipCertificateCheck|DangerousAcceptAnyServerCertificate|curl\s+-k|node(?:\.exe)?\s|Start-Process.*https:/i);
  assert.match(source, /AllowAutoRedirect = \$false/);
  assert.match(source, /DataProtectionScope\]::CurrentUser/);
  assert.match(source, /expectedInstallerSha256/);
  assert.match(source, /GetLeftPart\(\[UriPartial\]::Authority\) -cne \$Binding.origin/);
  assert.match(source, /\$pages -lt 400/);
  assert.match(source, /4194304/);
  assert.match(source, /ZipArchive/);
});

test('native monitor PowerShell behavioral fixtures', { skip: process.platform !== 'win32' ? 'ACL and DPAPI require the actual Windows job' : available.error?.code === 'ENOENT' ? 'PowerShell unavailable; actual WinPS5.1 fixture required' : false }, () => {
  assert.equal(available.status, 0, available.stderr);
  const result = spawnSync(runtime, ['-NoLogo', '-NoProfile', '-File', fixture, '-BridgePath', bridge], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS: native monitor binding/);
});
