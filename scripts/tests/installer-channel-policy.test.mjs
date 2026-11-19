import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8');
const stableLinux = 'linux-v1.0.6-bc0679d83df8';
const windowsWsl = 'server-wsl-v1.0.6-rc.1-dad063393b53';
const stableClient = 'client-v1.0.1-079fd0f9d4b1';
const legacyDocker = 'server-setup-v1.0.4-079fd0f9d4b1';

test('product catalogs give primary WSL2, Linux and Client channels before Docker Legacy', () => {
  for (const file of ['distribution/PRODUCTS.md', 'distribution/docs/en/PRODUCTS.md', 'distribution/docs/zh-CN/PRODUCTS.md']) {
    const content = read(file);
    for (const id of [windowsWsl, stableLinux, stableClient, legacyDocker])
      assert.ok(content.includes(id), `${file} should preserve exact release ${id}`);
    assert.match(content, /Legacy/);
    const legacyHeading = content.indexOf('## Legacy');
    assert.ok(legacyHeading > content.indexOf(windowsWsl) && legacyHeading > content.indexOf(stableLinux), file);
    const wslSection = content.slice(0, legacyHeading);
    assert.match(wslSection, /1\.0\.6-rc\.1/);
    assert.ok(!wslSection.includes('CastLink-Windows.zip'), `${file}: Docker ZIP must not be in main product list`);
    assert.ok(content.slice(legacyHeading).includes('/' + legacyDocker + '/CastLink-Windows.zip'), `${file}: legacy ZIP retained`);
  }
});

test('the Linux workflow cannot dispatch a new Windows Docker server-setup release', () => {
  const yaml = read('.github/workflows/easy-setup-packages.yml');
  assert.match(yaml, /options:\s*\[linux\]/);
  assert.match(yaml, /default:\s*linux/);
  assert.doesNotMatch(yaml, /options:\s*\[[^\]]*server-setup/);
  assert.match(yaml, /windows-powershell:\s*\n\s*#.*Legacy[^\n]*\n\s*if:\s*\$\{\{ false \}\}/);
  assert.match(yaml, /packages:\s*\n[\s\S]*?if:\s*\$\{\{ inputs\.track == 'linux'/);
  assert.match(yaml, /packages-windows:\s*\n[\s\S]*?if:\s*\$\{\{ inputs\.track == 'linux'/);
});

test('localized READMEs refer users to WSL2 as primary without silently promoting an RC', () => {
  for (const file of ['README.md', 'README.ru.md', 'README.en.md', 'README.zh-CN.md']) {
    const content = read(file);
    assert.ok(content.includes('SUPPORTED_INSTALLERS.md'), file);
    assert.ok(content.includes('1.0.6-rc.1'), file);
    assert.ok(content.includes('Legacy'), file);
  }
  const policy = read('distribution/SUPPORTED_INSTALLERS.md');
  assert.match(policy, /prerelease/);
  assert.match(policy, /no supported automatic migration|автоматическая миграция/i);
});

test('historic release metadata and the client are preserved for compatibility', () => {
  const manifest = read('distribution/release-tracks.json');
  assert.ok(manifest.includes('server-setup'));
  assert.ok(manifest.includes('linux'));
  assert.ok(manifest.includes('client'));
});
