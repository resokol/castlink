const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { summarizeParticipants } = load('../lib/connection-history.ts');
const row = (session, identity, reconnects, lastSeen, role = 'guest') => ({ session, identity, role, name: 'Same name', firstSeen: lastSeen - 10, lastSeen, latest: { reconnects, streams: [], state: 'connected', uptimeSec: 1 } });
const connections = [row('a', 'guest-1', 2, 100), row('b', 'guest-1', 1, 200), row('c', 'guest-2', 0, 300), row('d', 'guest-1', 0, 400, 'studio')];
const before = JSON.stringify(connections);
const participants = summarizeParticipants(connections);
assert.equal(participants.length, 3, 'names never merge different identities; roles remain distinct');
assert.deepEqual(participants.find(p => p.identity === 'guest-1' && p.role === 'guest'), { identity: 'guest-1', role: 'guest', name: 'Same name', sessions: 2, repeatSessions: 1, reconnects: 3, firstSeen: 90, lastSeen: 200 });
assert.equal(JSON.stringify(connections), before, 'summarizing does not mutate raw sessions');
assert.deepEqual(summarizeParticipants([]), []);
assert.equal(summarizeParticipants([connections[0]] )[0].repeatSessions, 0, 'selection does not invent earlier sessions');
const repeated = summarizeParticipants([connections[0], {...connections[0], lastSeen: 110, latest: { reconnects: 4 } }]);
assert.equal(repeated[0].sessions, 1, 'duplicate session observations do not become repeat entries');
assert.equal(repeated[0].reconnects, 4, 'session counters are counted once');
const { participantsCsv, connectionsCsv } = load('../lib/stats-csv.ts');
const { statisticsReport } = load('../lib/stats-report.ts');
const history = { connections, series: [], from: 0, to: 500, bucketMs: 2000 };
assert.match(participantsCsv(history), /"Same name";"guest-1";"Гость";"2";"1";"3"/);
assert.equal(connectionsCsv(history).split('\r\n').length, 5, 'existing export retains all raw sessions');
const unsafe = {...history, connections: [{...connections[0], name: '<img src=x onerror=alert(1)>'}]};
const html = statisticsReport(unsafe, 'room', 'all');
assert.match(html, /Повторные сессии/);
assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img/);
assert.match(statisticsReport(history, 'room', 'all'), /Сетевые переподключения/);
console.log('PASS: participant summaries distinguish identities, roles, sessions and cumulative reconnects; CSV/HTML preserve details and escape names');

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let stateIndex = 0;
const states = { 5: history };
const { StatisticsDashboard } = load('../components/StatisticsDashboard.tsx', {
  react: {...React, useState(initial) { const i = stateIndex++; return [i in states ? states[i] : initial, value => { states[i] = value; }]; }, useEffect() {}, useRef: value => ({current: value}) },
  '@/components/I18nProvider': {useI18n: () => ({locale: 'ru', t: value => value})},
});
const props = {roomName: 'room', identity: 'owner', studioRole: 'primary', studioClientId: 'client', studioEpoch: 1};
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const tree = StatisticsDashboard(props);
const markup = renderToStaticMarkup(tree);
assert.match(markup, /Участников в выборке<\/span><strong>3/);
assert.match(markup, /Повторные сессии<\/span><strong>1/);
assert.match(markup, /Сетевые переподключения<\/span><strong>3/);
const participantButton = nodes(tree).find(node => node.type === 'button' && node.props.children === 'Same name');
participantButton.props.onClick();
assert.equal(states[2], 'guest'); assert.equal(states[3], 'guest-1'); assert.equal(states[4], '', 'participant selection includes all its sessions');
stateIndex = 0;
const filteredTree = StatisticsDashboard(props);
const exportButton = nodes(filteredTree).find(node => node.type === 'button' && node.props.children === 'Участники → CSV');
let downloaded;
global.document = {createElement: () => ({click() {}, remove() {}}), body: {appendChild() {}}};
URL.createObjectURL = blob => { downloaded = blob; return 'blob:test'; }; URL.revokeObjectURL = () => {};
global.fetch = async url => {
  const params = new URL(url, 'https://test').searchParams;
  assert.equal(params.get('role'), 'guest'); assert.equal(params.get('participant'), 'guest-1'); assert.equal(params.has('session'), false);
  return {ok: true, json: async () => history};
};
exportButton.props.onClick();
setImmediate(async () => {
  try {
    const exported = await downloaded.text();
    assert.match(exported, /"guest-1";"Гость";"2";"1";"3"/);
    assert.doesNotMatch(exported, /guest-2|Студия/);
    console.log('PASS: dashboard distinguishes participants and sessions; participant CSV export preserves selection');
  } catch (error) { console.error(error); process.exitCode = 1; }
});
