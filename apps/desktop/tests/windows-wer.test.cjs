'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const afterPack = require('../scripts/windows-wer.cjs');

test('Windows payload carries the upstream helper alongside the actual client executable', async t => {
  const desktop = path.resolve(__dirname, '..');
  const preview = require('../scripts/package-client-preview.cjs').previewConfiguration(desktop, '.', '.', []);
  const privateTest = require('../scripts/package-pptx-test.cjs').privateBuilderConfig({stage:'.', output:'.', electron:'45.4.1'});
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'castlink-wer-test-'));
  t.after(() => fs.rm(folder, { recursive:true, force:true }));
  for (const config of [{productName:'CastLink Client', afterPack:require.resolve('../scripts/windows-wer.cjs')}, preview, privateTest]) {
    const { productName } = config;
    assert.equal(require(config.afterPack), afterPack);
    const appOutDir = path.join(folder, productName);
    await fs.mkdir(appOutDir);
    const context = { electronPlatformName:'win32', appOutDir, packager:{appInfo:{productFilename:productName}} };
    await fs.writeFile(path.join(appOutDir, productName + '.exe'), 'client');
    await assert.rejects(afterPack(context), { code:'ENOENT' });
    await fs.writeFile(path.join(appOutDir, 'electron_wer.dll'), 'original bytes');
    await afterPack(context);
    assert.deepEqual((await fs.readdir(appOutDir)).sort(), [productName + '.exe', productName + '_wer.dll']);
    assert.equal(await fs.readFile(path.join(appOutDir, productName + '_wer.dll'), 'utf8'), 'original bytes');
  }
});
