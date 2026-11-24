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
  assert.match(source, /c933c4e0163cd7d78960796fcf27b5908cf2feb05fd95ccfd9d3cc37334a5b2b/);
  // SSH.NET only accepts an immutable string for an encrypted key's passphrase.
  // The password-authentication path passes UTF-8 bytes directly.
  const passwordTransport = source.replace('return new PrivateKeyFile(stream, Marshal.PtrToStringUni(pointer));', '');
  assert.doesNotMatch(passwordTransport, /Start-Process|Invoke-Expression|sshpass|ConvertFrom-SecureString|PtrToString|Write-(?:Host|Output).*Password/i);
});

test('the cleanup allowlist covers exactly the pinned SSH cache files and keeps legacy cache recognition', () => {
  const source = readFileSync(helper, 'utf8');
  const cleanup = readFileSync(new URL('../simple-easy-setup-cleanup.ps1', import.meta.url), 'utf8');
  const directory = source.match(/Join-Path \$ToolsDir '(sshnet-[^']+)'/)[1];
  const patterns = [...cleanup.matchAll(/\$relative -cmatch '([^']+)'/g)].map(match => new RegExp(match[1]));
  const owned = file => patterns.some(pattern => pattern.test(file));
  const pins = [...source.matchAll(/Id='([^']+)';Version='([^']+)';Framework='[^']+';Dll='([^']+)';Sha256='[a-f0-9]{64}'/g)];
  assert.ok(pins.length >= 9);
  for (const [,id,version] of pins) {
    for (const extension of ['dll', 'nupkg']) {
      assert.ok(owned(`.tools/${directory}/${id}.${version}.${extension}`), id);
      assert.equal(owned(`.tools/${directory}/${id}.999.0.0.${extension}`), false);
    }
  }
  assert.ok(owned('.tools/sshnet-2024.2.0/SSH.NET.2024.2.0.nupkg'));
  assert.ok(owned('.tools/sshnet-2026.0.1/Renci.SshNet.dll'));
  assert.ok(owned('.tools/sshnet-2026.0.1/Microsoft.Extensions.Logging.Abstractions.11.0.0.nupkg'));
  assert.equal(owned('.tools/' + directory + '/unrelated.dll'), false);
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
