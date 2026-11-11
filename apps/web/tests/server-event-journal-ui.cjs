const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');
const { ServerEventRows, ServerEventJournal } = load('../components/ServerEventJournal.tsx', {
  './I18nProvider': { useI18n: () => ({ locale: 'en', t: value => value }) },
});
const event = { id: 12, at: 1700000000000, level: 'error', event: '<script>bad()</script>', service: 'castlink-web', fields: { status: 503, reason: '<img src=x onerror=bad()>' } };
const markup = renderToStaticMarkup(React.createElement('table', null, React.createElement(ServerEventRows, { events: [event] })));
assert.match(markup, /<time/);
assert.match(markup, /Ошибка/);
assert.match(markup, /503/);
assert.match(markup, /&lt;script&gt;/);
assert.doesNotMatch(markup, /<script>|<img/);
const empty = renderToStaticMarkup(React.createElement('table', null, React.createElement(ServerEventRows, { events: [] })));
assert.match(empty, /За выбранный период событий нет/);
const panel = renderToStaticMarkup(React.createElement(ServerEventJournal));
assert.match(panel, /Журнал событий/);
assert.match(panel, /value="error"/);
assert.match(panel, /value="warn"/);
assert.match(panel, /24 часа/);
console.log('PASS: bounded event journal controls, readable severity, timestamps, empty state and HTML escaping');
