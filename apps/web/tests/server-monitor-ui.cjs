const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../components/ServerMonitor.tsx'), 'utf8');
assert.match(source, /visibilitychange/, 'sampling pauses for hidden tabs');
assert.match(source, /\.abort\(/, 'active request is cancelled on unmount/hidden tab');
assert.doesNotMatch(source, /setInterval\(/, 'polling must wait for the previous request to finish');
assert.match(source, /role="img"/, 'charts have an accessible description');
assert.match(source, /<table/, 'recorded values have an accessible table alternative');
assert.match(source, /<time/, 'history shows sample timestamps');
assert.match(source, /устарел/, 'stale data is explicit');
assert.match(source, /нет данных/, 'unavailable data is not shown as zero');
const { load } = require('./load-typescript.cjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MetricChart } = load('../components/ServerMonitor.tsx', {
  './I18nProvider': { useI18n: () => ({ locale: 'en', t: value => value }) },
});
const render = (values, options = {}) => renderToStaticMarkup(React.createElement(MetricChart, {
  title: 'CPU', unit: '%', ceiling: 100,
  history: values.map(([at, value, from, gapBefore]) => ({ at, value, from, gapBefore })),
  series: [{ label: 'CPU', color: 'green', value: point => point.value }],
  ...options,
}));
const gaps = render([[0, 0], [5000, null], [10000, 20], [30000, 40]]);
assert.equal(gaps.match(/<path d="([^"]*)"/)[1].split('M').length - 1, 3, 'unavailable or stale intervals break the graph');
assert.match(gaps, /M0,114/, 'a measured zero is drawn on the baseline');
assert.doesNotMatch(gaps, /NaN|Infinity/);
assert.match(render([[0, null]]), /нет данных/);
assert.match(render([[0, 0]]), /0 %/, 'a real zero retains its numeric value');
const aggregated = render([[0, 10], [120000, 40], [480000, 80]], { pointIntervalMs: 120000, current: { at: 480000, value: 7 } });
assert.equal(aggregated.match(/<path d="([^"]*)"/)[1].split('M').length - 1, 2, 'bucket cadence stays connected; real outages remain gaps');
assert.match(aggregated, /7 %/, 'current legend is a raw measurement, not the bucket peak');
const missingBucket = render([[119000, 10, 0], [359000, 20, 240000]], { pointIntervalMs: 120000 });
assert.equal(missingBucket.match(/<path d="([^"]*)"/)[1].split('M').length - 1, 2, 'a completely missing time bucket is a visible gap');
const rawOutage = render([[0, 10, 0], [239000, 20, 120000, true]], { pointIntervalMs: 120000 });
assert.equal(rawOutage.match(/<path d="([^"]*)"/)[1].split('M').length - 1, 2, 'raw sampling outages remain gaps between adjacent peak buckets');
const { ServerMonitor } = load('../components/ServerMonitor.tsx', {
  './I18nProvider': { useI18n: () => ({ locale: 'en', t: value => value }) },
});
const panel = renderToStaticMarkup(React.createElement(ServerMonitor));
assert.match(panel, /24 часа/, '24h history is discoverable');
assert.match(panel, /Журнал событий/, 'events are available alongside metrics');
console.log('PASS: monitoring chart semantics, history table, timestamps, explicit stale/unavailable and bounded polling lifecycle');
