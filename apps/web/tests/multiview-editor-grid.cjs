const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { editorGridSteps, parseEditorGridPreference, editorGridPath } = load('../lib/multiview-editor-grid.ts');

assert.deepEqual(editorGridSteps, [160, 80, 40, 20], 'grid spacing is available from coarse to fine');
for (const raw of [null, '', '{', 'null', '[]', 'true', '"grid"']) assert.deepEqual(parseEditorGridPreference(raw), { visible: false, step: 80 });
for (const step of editorGridSteps) assert.deepEqual(parseEditorGridPreference(JSON.stringify({ visible: true, step })), { visible: true, step });
for (const step of [0, -20, 10, 81, 100000, '20', null]) assert.deepEqual(parseEditorGridPreference(JSON.stringify({ visible: 'true', step })), { visible: false, step: 80 }, 'invalid preferences cannot enable a grid or unbounded line count');
assert.deepEqual(parseEditorGridPreference('{"visible":false,"step":40,"scene":{"tiles":[]}}'), { visible: false, step: 40 }, 'only editor preference fields are retained');

for (const [width, height, displayedWidth] of [[1920, 1080, 960], [1440, 1080, 360]]) {
  for (const step of editorGridSteps) {
    const path = editorGridPath(width, height, step);
    const vertical = [...path.matchAll(/M([\d.]+) 0V([\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
    const horizontal = [...path.matchAll(/M0 ([\d.]+)H([\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
    assert.equal(vertical.length, Math.ceil(width / step) - 1);
    assert.equal(horizontal.length, Math.ceil(height / step) - 1);
    assert.equal(vertical[0][0], step); assert.equal(horizontal[0][0], step);
    assert.ok(vertical.every(([position, end], index) => position === (index + 1) * step && position < width && end === height));
    assert.ok(horizontal.every(([position, end], index) => position === (index + 1) * step && position < height && end === width));
    const displayedHeight = displayedWidth * height / width;
    assert.ok(Math.abs(vertical[0][0] / width * displayedWidth - horizontal[0][0] / height * displayedHeight) < 1e-9, 'scene-unit spacing stays square when preview scales');
  }
}
for (const args of [[0, 1080, 20], [1920, NaN, 20], [Infinity, 1080, 20], [90000, 1080, 20], [1920, 1080, 0], [1920, 1080, 21]]) assert.equal(editorGridPath(...args), '', 'invalid dimensions/step cannot generate unbounded geometry');
assert.equal((editorGridPath(8192, 8192, 20).match(/M/g) || []).length, 818, 'largest scene remains bounded');

// Execute the actual storage effects and controls, including StrictMode's setup probe.
const fs = require('node:fs'), ts = require('typescript'), vm = require('node:vm');
const file = ts.createSourceFile('MultiviewEditor.tsx', fs.readFileSync(`${__dirname}/../components/multiview/MultiviewEditor.tsx`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let readEffect, writeEffect, toggle, spacing;
(function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(file) === 'useEffect') {
    const effect = node.arguments[0];
    if (effect.getText(file).includes('localStorage.getItem(editorGridStorageKey)')) readEffect = effect;
    if (effect.getText(file).includes('localStorage.setItem(editorGridStorageKey')) writeEffect = effect;
  }
  if (ts.isJsxElement(node)) {
    const attributes = node.openingElement.attributes.properties.map(attribute => attribute.getText(file)).join(' ');
    if (node.openingElement.tagName.getText(file) === 'button' && attributes.includes('editorGrid.visible')) toggle = node;
    if (node.openingElement.tagName.getText(file) === 'select' && attributes.includes('editorGrid.step')) spacing = node;
  }
  ts.forEachChild(node, visit);
})(file);
assert.ok(readEffect && writeEffect && toggle && spacing);
const evaluate = (node, scope) => vm.runInNewContext(ts.transpileModule(`(${node.getText(file)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, scope);
let preference = { visible: false, step: 80 }, loaded = false, stored = '{"visible":true,"step":20}', writes = 0;
const storageScope = () => ({ parseEditorGridPreference, editorGridStorageKey: 'fixture-editor-grid', editorGrid: preference, gridPreferenceLoaded: loaded,
  setEditorGrid: value => { preference = typeof value === 'function' ? value(preference) : value; }, setGridPreferenceLoaded: value => { loaded = value; },
  localStorage: { getItem: () => stored, setItem: (key, value) => { writes++; stored = value; } },
});
const mountScope = storageScope();
for (let probe = 0; probe < 2; probe++) { evaluate(readEffect, mountScope)(); evaluate(writeEffect, mountScope)(); }
assert.equal(writes, 0, 'StrictMode setup cannot overwrite saved preference with the first render default');
assert.deepEqual(preference, { visible: true, step: 20 });
evaluate(writeEffect, storageScope())(); assert.equal(writes, 1); assert.deepEqual(JSON.parse(stored), preference);
const blocked = { ...storageScope(), localStorage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } };
assert.doesNotThrow(() => evaluate(readEffect, blocked)()); assert.doesNotThrow(() => evaluate(writeEffect, blocked)());
const scene = { width: 1920, height: 1080, tiles: [{ id: 'existing', x: .1, y: .2 }] }, before = JSON.stringify(scene);
const controlScope = () => ({ ...storageScope(), scene, editorGridSteps, gridUi: { show: 'Show grid', step: 'Grid spacing', unit: 'px' },
  React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) }, edit() { throw Error('Visual grid must not edit scene'); }, setSnapping() { throw Error('Visual grid must not change snapping'); },
});
evaluate(toggle, controlScope()).props.onClick(); assert.equal(preference.visible, false);
evaluate(spacing, controlScope()).props.onChange({ target: { value: '40' } }); assert.equal(preference.step, 40);
evaluate(spacing, controlScope()).props.onChange({ target: { value: '1' } }); assert.equal(preference.step, 40);
assert.equal(JSON.stringify(scene), before, 'grid visibility and step are independent of scene geometry');
console.log('PASS editor-only grid preference validation, bounded scene-space lines and square 16:9/4:3 scaling');
