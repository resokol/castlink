import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));

test('web and Windows consume matching canonical brand assets', () => {
  const svg = fs.readFileSync('assets/brand/castlink-icon.svg');
  assert.deepEqual(fs.readFileSync('apps/web/app/icon.svg'), svg);
  const ico = fs.readFileSync('scripts/simple-easy-setup-control.ico');
  assert.deepEqual(fs.readFileSync('apps/web/app/favicon.ico'), ico);
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);
  for (const [index, size] of [16, 24, 32, 48, 64, 128, 256].entries()) {
    const entry = 6 + index * 16;
    assert.equal(ico[entry] || 256, size);
    assert.equal(ico[entry + 1] || 256, size);
    const offset = ico.readUInt32LE(entry + 12);
    assert.equal(ico.readInt32LE(offset + 4), size);
    assert.equal(ico.readInt32LE(offset + 8), size * 2);
    assert.equal(ico.readUInt16LE(offset + 14), 32);
    assert.ok(offset + ico.readUInt32LE(entry + 8) <= ico.length);
  }
  // Next's metadata file conventions package these without a public/ copy step.
  const apple = fs.readFileSync('apps/web/app/apple-icon.png');
  assert.equal(apple.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(apple.readUInt32BE(16), 180);
  assert.equal(apple.readUInt32BE(20), 180);
});

test('shared brand image renders beside the wordmark without duplicate accessible text', () => {
  const ts = webRequire('typescript');
  const Module = require('node:module');
  const source = fs.readFileSync('apps/web/components/BrandIcon.tsx', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = new Module(import.meta.filename);
  module.paths = Module._nodeModulePaths(process.cwd() + '/apps/web');
  module._compile(compiled, import.meta.filename);
  const React = webRequire('react');
  const { renderToStaticMarkup } = webRequire('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(module.exports.BrandIcon, { className: 'studio-brand-mark' }));
  assert.match(html, /src="\/icon\.svg"/);
  assert.match(html, /class="studio-brand-mark"/);
  assert.match(html, /alt=""/);
  assert.match(html, /aria-hidden="true"/);
});
