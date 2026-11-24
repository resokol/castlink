const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { load } = require("./load-typescript.cjs");

const locale = { locale: "en", t: load("../lib/i18n.ts").translate.bind(null, "en") };
const { IncidentMinuteEvidence } = load("../components/IncidentMinuteEvidence.tsx", {
  "./I18nProvider": { useI18n: () => locale },
});
const evidence = {
  slots: 12, paths: [{ publisher: "publisher", receiver: "receiver", kind: "video", track: "TR_cam",
    source: "camera", session: "session", peakKbps: 1280, peakLossPct: 8, peakJitterMs: null, slotsObserved: 7 }],
  clients: [], node: { reason: "platform-access-required", samples: [] },
};
const render = data => renderToStaticMarkup(React.createElement(IncidentMinuteEvidence, { evidence: data, name: id => id }));
assert.match(render(evidence), /7 \/ 12/);
assert.match(render(evidence), /receiver/);
assert.match(render(evidence), /platform administrator/);
assert.doesNotMatch(render(evidence), /Keyframes received/);
assert.match(render({ ...evidence, node: { samples: [{ at: 123456, livekit: "ok", keyframes: { from: 110000, at: 123456, incoming: 0, outgoing: 9 } }] } }), /Keyframes received/);

const start = Date.parse("2026-10-02T14:00:00"), end = start + 120000;
const episode = { firstAt: start + 25000, lastAt: start + 37000, from: start + 17000, to: start + 45000,
  lossPct: 7.4, concealedPct: 9.1, freezes: 2, reconnect: true, poorQuality: true };
let history = { from: start, to: end, retainedFrom: start, series: [], connections: [],
  problemPeriods: { total: 11, periods: [episode] } };
function nodes(item) {
  if (!item || typeof item !== "object") return [];
  if (Array.isArray(item)) return item.flatMap(nodes);
  return [item, ...nodes(item.props?.children)];
}
let index = 0, state = [], ref = { current: null }, download;
const { RoomMediaDiagnostics } = load("../components/RoomMediaDiagnostics.tsx", {
  "./I18nProvider": { useI18n: () => locale },
  react: { ...React, useRef: () => ref, useEffect() {}, useState: initial => {
    const i = index++; if (!(i in state)) state[i] = initial;
    return [state[i], value => { state[i] = value; }];
  } },
});
let dashboardIndex;
const { StatisticsDashboard } = load("../components/StatisticsDashboard.tsx", {
  "./RoomMediaDiagnostics": { RoomMediaDiagnostics },
  "@/components/I18nProvider": { useI18n: () => locale },
  react: { ...React, useEffect() {}, useRef: value => ({ current: value }), useState: initial => {
    const i = dashboardIndex++;
    const states = { 2: "guest", 3: "receiver", 4: "connection", 5: history };
    return [i in states ? states[i] : initial, () => {}];
  } },
});
function panel() {
  dashboardIndex = 0;
  const dashboard = StatisticsDashboard({ studioId: "tenant", roomName: "A", platformMediaRoom: "A-media",
    platformNodeId: "node1", studioRole: "primary", identity: "owner", studioClientId: "client", studioEpoch: 1 });
  const diagnostics = nodes(dashboard).find(node => node.type === RoomMediaDiagnostics);
  index = 0;
  return RoomMediaDiagnostics(diagnostics.props);
}
const button = text => nodes(panel()).find(el => el.type === "button" && el.props.children === text);
const episodeButton = () => button("Review episode");
const tick = () => new Promise(resolve => setImmediate(resolve));
const requests = [];
global.window = { location: { origin: "https://castlink.example" } };
global.document = { body: { appendChild() {} }, createElement: () => ({ click() { download = new URL(this.href); }, remove() {} }) };
let wrongRange = false;
global.fetch = async (url, options) => {
  requests.push(url);
  assert.equal(options.credentials, "same-origin");
  const params = url.searchParams, to = Number(params.get("to"));
  const report = { sampleCount: 0, complete: true, sfu: { samples: [] }, diagnosis: { findings: [], coverage: { evaluable: 0 } } };
  if (params.has("minute")) {
    const minute = Number(params.get("minute"));
    return Response.json({ ...report, minute, from: minute, to: Math.min(to, minute + 59999), incident: evidence });
  }
  return Response.json({ ...report, from: params.has("from") && !wrongRange ? Number(params.get("from")) : to - 900000, to });
};
function checkUrl(url, mode, scope) {
  assert.equal(url.pathname, "/api/super-admin/history");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    studioId: "tenant", room: "A-media", minutes: "15", role: "guest", participant: "receiver",
    session: "connection", nodeId: "node1", diagnostics: mode, ...scope,
  });
}
(async () => {
  const markup = renderToStaticMarkup(panel());
  for (const text of ["Peak packet loss 7.4%", "Peak audio concealment 9.1%", "2 new freezes",
    "Reconnect", "Poor connection quality", "out of 11"]) assert.ok(markup.includes(text), text);
  const time = at => new Date(at).toLocaleString("en", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  assert.ok(markup.includes(time(episode.firstAt) + " — " + time(episode.lastAt)));
  assert.equal(requests.length, 0);
  episodeButton().props.onClick();
  await tick();
  const scope = { from: String(episode.from), to: String(episode.to) };
  checkUrl(requests.at(-1), "analysis", scope);

  // The polling result moves forward and the selected episode drops out of the list.
  history = { ...history, from: start + 15000, to: end + 15000, problemPeriods: { total: 0, periods: [] } };
  button("Download this episode’s diagnostics").props.onClick();
  checkUrl(download, "full", scope);
  assert.match(renderToStaticMarkup(panel()), /No signs of connection trouble/);
  button("Download full diagnostics").props.onClick();
  checkUrl(download, "full", { to: String(history.to) });
  assert.equal(requests.length, 1, "refreshing the overview never requests in-depth analysis");

  const input = nodes(panel()).find(el => el.type === "input");
  input.props.onChange({ target: { value: "2026-10-02T14:01" } });
  nodes(panel()).find(el => el.type === "form").props.onSubmit({ preventDefault() {} });
  await tick();
  checkUrl(requests.at(-1), "analysis", { minute: String(start + 60000), to: String(history.to) });
  button("Download this minute’s diagnostics").props.onClick();
  checkUrl(download, "full", { minute: String(start + 60000), to: String(start + 119999) });
  assert.equal(button("Download this episode’s diagnostics"), undefined);

  history = { ...history, retainedFrom: null };
  assert.match(renderToStaticMarkup(panel()), /No measurements match/);
  history = { ...history, problemPeriods: undefined };
  assert.match(renderToStaticMarkup(panel()), /unavailable on this node/);
  assert.ok(!button("Review minute").props.disabled);
  history = { ...history, retainedFrom: start, problemPeriods: { total: 1, periods: [episode] } };
  wrongRange = true;
  episodeButton().props.onClick();
  await tick();
  assert.ok(nodes(panel()).some(el => el.props.role === "alert"), "reject an older node returning the entire period");
  assert.equal(button("Download this episode’s diagnostics"), undefined);
  console.log("PASS suggested episodes from filtered dashboard history, localized evidence and states, exact scoped analysis and downloads across refresh, manual minute review");
})().catch(e => { console.error(e); process.exitCode = 1; });
