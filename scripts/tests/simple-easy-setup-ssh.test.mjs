import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const helper = new URL('../simple-easy-setup-ssh.ps1', import.meta.url);
test('password SSH helper provides a pinned portable dependency and reusable transport API', () => {
  assert.ok(existsSync(helper), 'Password SSH helper is missing');
  const source = readFileSync(helper, 'utf8');
  for (const name of ['Install-SimpleSshDependency', 'Connect-SimpleSsh', 'Invoke-SimpleSshCommand', 'Upload-SimpleSshFile', 'Disconnect-SimpleSsh', 'ConvertTo-SimplePosixLiteral']) {
    assert.match(source, new RegExp(`function ${name}\\s*\\{`));
  }
  assert.match(source, /api\.nuget\.org\/v3-flatcontainer/);
  assert.match(source, /0873cf5e9d72bd25c509ca86cb57e8301923e2dc2162e93207968b16c153894e/);
  assert.doesNotMatch(source, /Start-Process|Invoke-Expression|sshpass|ConvertFrom-SecureString|PtrToString|Write-(?:Host|Output).*Password/i);
});

test('stock Windows PowerShell runs actual SSH helper boundary fixtures', {
  skip: process.platform !== 'win32' && 'Requires genuine Windows PowerShell 5.1; source checks are not runtime proof',
}, () => {
  const executable = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const fixture = fileURLToPath(new URL('./simple-easy-setup-ssh.fixtures.ps1', import.meta.url));
  const result = spawnSync(executable, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fixture], {encoding:'utf8', timeout:30000, windowsHide:true});
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /SSH behavioral fixtures passed/);
});
