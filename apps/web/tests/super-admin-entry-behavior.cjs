const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');

exports.run = async () => {
  const savedWindow = global.window, savedFetch = global.fetch;
  async function scenario({ hash = '', href, statuses = [], allowed = [], networkFailure = false, malformedAt, strict = false, unmount = false }) {
    let cursor = 0, hooks = [], effect, calls = [], redirects = [], scrubbed = false;
    const react = {
      useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial; return [hooks[index], value => { hooks[index] = value; }]; },
      useRef(initial) { const index = cursor++; return hooks[index] ||= { current: initial }; },
      useEffect(callback) { effect = callback; },
    };
    const location = { href: new URL(href || `/super-admin?return=https://untrusted.example${hash}`, 'https://castlink.example').href, replace: target => redirects.push(target) };
    const hadFragment = !!new URL(location.href).hash;
    global.window = { location, history: { replaceState(_state, _title, value) { scrubbed = true; location.href = new URL(value, location.href).href; } } };
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    global.fetch = async (url, options = {}) => {
      const index = calls.length;
      calls.push({ url, options });
      if (hadFragment) assert.ok(scrubbed, 'fragment is removed before any access request');
      if (strict && index === 0) await pending;
      if (networkFailure) throw new Error('sensitive response, invitation or transport detail');
      const status = statuses[index] ?? 200;
      return { ok: status >= 200 && status < 300, status, json: async () => { if (index === malformedAt) throw new Error('sensitive JSON failure'); return { allowed: allowed[index] ?? false, error: 'sensitive response data must not be reflected' }; } };
    };
    const { default: Page } = load('../app/super-admin/page.tsx', { react, '@/components/I18nProvider': { useI18n: () => ({ t: key => key }) } });
    const render = () => { cursor = 0; return renderToStaticMarkup(Page()); };
    render();
    const cleanups = [effect()];
    if (strict) { cleanups[0](); cleanups.push(effect(), effect()); }
    if (unmount) for (const cleanup of cleanups) cleanup();
    release();
    for (let n = 0; n < 12; n++) await new Promise(resolve => setImmediate(resolve));
    const html = render();
    assert.doesNotMatch(html, /sensitive|csa2\.|untrusted\.example|ServerMonitor/);
    return { calls, redirects, html, scrubbed };
  }
  try {
    for (const href of ['https://castlink.example/super-admin#access=csa2.' + 'A'.repeat(43), '/super-admin#access=' + encodeURIComponent('csa2.' + 'B'.repeat(43)), '/super-admin?return=https://untrusted.example#access=csa2.' + 'C'.repeat(43)]) {
      const valid = await scenario({ href, allowed: [true, true], strict: true });
      assert.equal(valid.calls.length, 2); assert.equal(valid.calls[0].options.method, 'POST');
      assert.equal(JSON.parse(valid.calls[0].options.body).action, 'accept');
      assert.equal(valid.calls[1].options.method || 'GET', 'GET');
      assert.deepEqual(valid.redirects, ['/servers'], 'StrictMode redeems once and redirects only after cookie confirmation');
    }
    for (const status of [400, 401, 403, 429, 503]) {
      const denied = await scenario({ hash: '#access=csa2.invalid', statuses: [status], strict: true });
      assert.equal(denied.calls.length, 1); assert.deepEqual(denied.redirects, []); assert.ok(denied.scrubbed);
      assert.match(denied.html, /одноразовую ссылку/);
      if (status >= 429) assert.match(denied.html, /role="alert"/);
    }
    const absent = await scenario({ allowed: [false] });
    assert.equal(absent.calls.length, 1); assert.notEqual(absent.calls[0].options.method, 'POST'); assert.deepEqual(absent.redirects, []);
    const existing = await scenario({ allowed: [true], strict: true }); assert.deepEqual(existing.redirects, ['/servers']); assert.equal(existing.calls.length, 1);
    const cookieDenied = await scenario({ hash: '#access=csa2.valid', allowed: [true, false] }); assert.deepEqual(cookieDenied.redirects, []);
    const noConfirmation = await scenario({ hash: '#access=csa2.valid', allowed: [false] }); assert.deepEqual(noConfirmation.redirects, []);
    const failed = await scenario({ hash: '#access=csa2.valid', networkFailure: true }); assert.deepEqual(failed.redirects, []); assert.match(failed.html, /role="alert"/);
    for (const malformedAt of [0, 1]) {
      const malformed = await scenario({ hash: '#access=csa2.valid', allowed: [true, true], malformedAt });
      assert.deepEqual(malformed.redirects, []); assert.match(malformed.html, /role="alert"/);
    }
    const statusFailed = await scenario({ hash: '#access=csa2.valid', allowed: [true], statuses: [200, 503] });
    assert.deepEqual(statusFailed.redirects, []); assert.match(statusFailed.html, /Не удалось проверить доступ Super Admin/);
    const gone = await scenario({ hash: '#access=csa2.valid', allowed: [true, true], strict: true, unmount: true });
    assert.equal(gone.calls.filter(call => call.options.method === 'POST').length, 1);
    assert.deepEqual(gone.redirects, [], 'completed acceptance cannot navigate after unmount');
    for (const hash of ['#access=', '#access=one&access=two', '#access=' + 'X'.repeat(4097)]) {
      const invalid = await scenario({ hash }); assert.equal(invalid.calls.length, 0); assert.deepEqual(invalid.redirects, []); assert.ok(invalid.scrubbed);
    }
  } finally { global.window = savedWindow; global.fetch = savedFetch; }
};
