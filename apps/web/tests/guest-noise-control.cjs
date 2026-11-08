require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, file);
const { GuestNoiseSuppressionControl } = require('../components/GuestNoiseSuppressionControl.tsx');
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const changes = [];
const props = { profile: 'raw', state: 'off', confirmed: true, disabled: false, busy: false, onChange: value => changes.push(value) };
let tree = GuestNoiseSuppressionControl(props);
let toggle = nodes(tree).find(node => node.props?.role === 'switch');
assert.equal(toggle.props.checked, false);
assert.equal(toggle.props.disabled, false);
toggle.props.onChange({ target: { checked: true } });
assert.deepEqual(changes, ['speech']);
assert.ok(nodes(tree).some(node => String(node.props?.children).includes('наушники')));
tree = GuestNoiseSuppressionControl({ ...props, profile: 'speech', state: 'on' });
toggle = nodes(tree).find(node => node.props?.role === 'switch');
assert.equal(toggle.props.checked, true);
toggle.props.onChange({ target: { checked: false } });
assert.deepEqual(changes, ['speech', 'raw']);
assert.ok(nodes(tree).some(node => node.props?.role === 'status' && node.props.children === 'Шумоподавление и защита от эха включены.'));
tree = GuestNoiseSuppressionControl({ ...props, profile: 'speech', state: 'pending' });
assert.ok(nodes(tree).some(node => node.props?.role === 'status' && node.props.children === 'Обработка применится при включении микрофона.'));
tree = GuestNoiseSuppressionControl({ ...props, profile: 'speech', state: 'on', confirmed: false });
assert.ok(nodes(tree).some(node => node.props?.role === 'status' && node.props.children === 'Браузер не подтвердил обработку микрофона.'));
for (const patch of [{ disabled: true }, { busy: true }]) {
  tree = GuestNoiseSuppressionControl({ ...props, ...patch });
  assert.equal(nodes(tree).find(node => node.props?.role === 'switch').props.disabled, true);
}
console.log('PASS: caster can select speech/raw, actual/pending/unconfirmed processing and busy/disabled states');
