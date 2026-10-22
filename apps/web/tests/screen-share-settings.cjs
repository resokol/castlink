const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
let locale = 'ru', changed, ready = true;
const controls = { autoAccept: false, get preferencesReady() { return ready; }, setAutoAccept(value) { changed = value; } };
const { ScreenShareSettings } = load('../components/ScreenShareSettings.tsx', {
  './I18nProvider': { useI18n: () => ({ locale }) },
  './CoPresentationNavigation': { useCoPresentationNavigation: () => controls },
});
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
let tree = ScreenShareSettings();
assert.ok(nodes(tree).some(n => n.props?.children === 'Принимать управление автоматически'));
assert.ok(nodes(tree).some(n => n.props?.children === 'Выключите, чтобы подтверждать передачу управления.'));
const input = nodes(tree).find(n => n.type === 'input');
assert.equal(input.props.checked, false);
input.props.onChange({ target: { checked: true } });
assert.equal(changed, true);
ready = false;
assert.equal(nodes(ScreenShareSettings()).find(n => n.type === 'input').props.disabled, true);
for (locale of ['en', 'zh-CN']) {
  tree = ScreenShareSettings();
  assert.ok(!JSON.stringify(tree).includes('Принимать управление'));
}
console.log('PASS compact screen-share preference, callback, loading and locales');
