'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMacPermissionMenu } = require('../src/macos-permission-menu.cjs');

function harness({ responses = [], statuses = {}, locale = 'en', request, window } = {}) {
  const shown = [];
  const requested = [];
  const checked = [];
  const adapter = {
    status(kind) { checked.push(kind); return statuses[kind] || { granted: false, reason: `${kind}-denied` }; },
    async request(kind) { requested.push(kind); return request ? request(kind) : { granted: true }; },
  };
  const dialog = { async showMessageBox(...args) {
    shown.push({ window: args.length === 2 ? args[0] : undefined, options: args.at(-1) });
    return { response: responses.shift() ?? 6 };
  } };
  const item = createMacPermissionMenu({ adapter, dialog, getWindow: () => window, getLocale: () => locale });
  return { item, shown, requested, checked, statuses };
}

test('constructing a menu item never checks or requests OS permission', () => {
  const h = harness();
  assert.match(h.item.label, /macOS/);
  assert.equal(typeof h.item.click, 'function');
  assert.deepEqual(h.checked, []);
  assert.deepEqual(h.requested, []);
  assert.deepEqual(h.shown, []);
});

test('overview reports all permissions and Automation remains specific to each target', async () => {
  const h = harness({ statuses: { screen: { granted: true }, automation: { granted: true } } });
  await h.item.click();
  const { detail, buttons, cancelId, defaultId } = h.shown[0].options;
  assert.match(detail, /Screen Recording: Allowed/);
  assert.match(detail, /Accessibility: Not allowed/);
  assert.match(detail, /Microphone: Not allowed/);
  assert.match(detail, /Camera: Not allowed/);
  assert.match(detail, /Input Monitoring: Not allowed/);
  assert.match(detail, /Automation: Checked for each target app/);
  assert.equal(buttons.length, 7);
  assert.equal(cancelId, 6);
  assert.equal(defaultId, 6);
  assert.deepEqual(h.requested, []);
});

for (const [index, kind] of ['screen', 'accessibility', 'microphone', 'camera', 'automation', 'input-monitoring'].entries()) {
  test(`${kind} action requests only its fixed kind and rechecks actual OS state`, async () => {
    const h = harness({ responses: [index, 0, 2, 6] });
    await h.item.click({ kind: 'file:///renderer-input', url: 'https://untrusted.example' });
    assert.deepEqual(h.requested, [kind]);
    assert.match(h.shown[2].options.detail, kind === 'automation' ? /Checked for each target app/ : /Not allowed/);
    assert.equal(h.checked.filter(value => value === kind).length >= 2, kind !== 'automation');
    assert.equal(h.shown.every(({ options }) => !JSON.stringify(options).includes('untrusted.example')), true);
  });
}

test('a request result is not proof of approval; the async OS recheck is displayed', async () => {
  const statuses = {};
  const h = harness({ statuses, responses: [0, 0, 2, 6], request: async kind => {
    await Promise.resolve();
    statuses[kind] = { granted: true, reason: null };
    return { granted: false };
  } });
  await h.item.click();
  assert.match(h.shown[2].options.detail, /Allowed/);
  assert.match(h.shown[3].options.detail, /Screen Recording: Allowed/);
});

test('Recheck returns to the current permission without requesting it', async () => {
  const h = harness({ responses: [1, 1, 2, 6] });
  await h.item.click();
  assert.deepEqual(h.requested, []);
  assert.match(h.shown[2].options.message, /Accessibility/);
});

for (const [locale, label, status] of [
  ['en-US', 'macOS Permissions', 'Not allowed'],
  ['ru-RU', 'Разрешения macOS', 'Не разрешено'],
  ['zh-CN', 'macOS 权限', '未允许'],
]) {
  test(`native labels and guidance use ${locale}`, async () => {
    const h = harness({ locale });
    assert.match(h.item.label, new RegExp(label));
    await h.item.click();
    assert.match(h.shown[0].options.detail, new RegExp(status));
  });
}

test('live windows parent dialogs and destroyed windows do not', async () => {
  const live = { isDestroyed: () => false };
  const h = harness({ window: live });
  await h.item.click();
  assert.equal(h.shown[0].window, live);
  const dead = harness({ window: { isDestroyed: () => true } });
  await dead.item.click();
  assert.equal(dead.shown[0].window, undefined);
});

test('OS API errors show unknown status and safe request guidance without exception details', async () => {
  const shown = [];
  const responses = [0, 0, 2, 6];
  const item = createMacPermissionMenu({ adapter: {
    status() { throw new Error('private status'); },
    async request() { throw new Error('private request'); },
  }, dialog: { async showMessageBox(options) { shown.push(options); return { response: responses.shift() }; } } });
  await item.click();
  assert.match(shown[0].detail, /Unavailable/);
  assert.match(shown[2].detail, /Could not complete/);
  assert.doesNotMatch(JSON.stringify(shown), /private/);
});

test('concurrent menu clicks share one flow and dialog rejection permits later retry', async () => {
  let reject;
  let calls = 0;
  const item = createMacPermissionMenu({ adapter: { status: () => ({ granted: false }), request() {} },
    dialog: { showMessageBox() { calls += 1; return new Promise((resolve, fail) => { reject = fail; }); } },
  });
  const first = item.click();
  const second = item.click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 1);
  reject(new Error('dialog closed'));
  await Promise.all([first, second]);
  const retry = item.click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 2);
  reject(new Error('dialog closed'));
  await retry;
});

for (const [locale, title, separate] of [
  ['en', /Input Monitoring/, /Accessibility does not grant Input Monitoring/],
  ['ru', /Мониторинг ввода/, /Универсальный доступ не предоставляет мониторинг ввода/],
  ['zh-CN', /输入监控/, /辅助功能权限不会授予输入监控权限/],
]) {
  test(`Input Monitoring guidance is independent from Accessibility in ${locale}`, async () => {
    const h = harness({ locale, responses: [5, 2, 6], statuses: { accessibility: { granted: true } } });
    await h.item.click();
    assert.match(h.shown[1].options.message, title);
    assert.match(h.shown[1].options.detail, separate);
    assert.deepEqual(h.requested, []);
  });
}
