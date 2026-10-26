const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');
const chats = [], scenes = [];
let videoTracks = [], cursor = 0, hooks = [], effects = [], dirty = false, widgetChanged, lastTree;
const queryListeners = new Set();
const compactQuery = { matches: false, addEventListener: (_, listener) => queryListeners.add(listener), removeEventListener: (_, listener) => queryListeners.delete(listener) };
global.window = { matchMedia: () => compactQuery };
const room = { name: 'existing-media-room' };
const react = {
  ...React,
  useState(initial) {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks[index], next => { const value = typeof next === 'function' ? next(hooks[index]) : next; if (value !== hooks[index]) { hooks[index] = value; dirty = true; } }];
  },
  useEffect(effect, deps) {
    const index = cursor++, previous = hooks[index];
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) effects.push(() => {
      previous?.cleanup?.(); hooks[index] = { deps, cleanup: effect() };
    });
  },
};
const { RoomConference } = load('../components/RoomConference.tsx', {
  react,
  '@/components/I18nProvider': { useI18n: () => ({ locale: 'ru', t: value => value }) },
  '@/components/ConferenceScene': { ConferenceScene: props => {
    scenes.push(props);
    return React.createElement('div', { 'data-scene': true });
  } },
  '@/components/ScreenShareButton': { ScreenShareButton: props => React.createElement('button', { 'data-share': true, 'data-toolbar': props.toolbar }, 'Share') },
  '@/components/RoomChat': { RoomChat: props => {
    chats.push(props);
    return React.createElement('section', { 'data-chat': true, hidden: !props.visible }, 'Chat');
  } },
  '@livekit/components-react': {
    useRoomContext: () => room,
    useTracks: sources => typeof sources[0] === 'object' ? videoTracks : [],
    usePinnedTracks: () => [],
    useCreateLayoutContext: () => ({ widget: { state: { showChat: false }, dispatch() {} } }),
    LayoutContextProvider: ({ children, onWidgetChange }) => { widgetChanged = onWidgetChange; lastTree = children; return children; },
    ChatToggle: ({ children, ...props }) => React.createElement('button', props, children),
  },
});
const base = { studioOnly: false, onLeave() {}, microphoneControl: React.createElement('button', null, 'Mic'), cameraControl: React.createElement('button', null, 'Camera') };
const extraControls = React.createElement('button', { 'data-presentation': true }, 'Presentation');
const settingsControl = React.createElement('button', { 'data-settings': true }, 'Settings');
const transportControl = React.createElement('button', { 'data-transport': true }, 'Transport');
const props = { ...base, workspaceLayout: true, extraControls, settingsControl, transportControl };
const render = changes => {
  let renders = 0, html;
  do {
    dirty = false; cursor = 0;
    // Render through navigation/context wrappers before inspecting layout children
    // and flushing the effects registered by the actual conference content.
    html = renderToStaticMarkup(RoomConference({ ...props, ...changes }));
    while (effects.length) effects.shift()();
    assert.ok(++renders < 5, 'responsive effects settle without a render loop');
  } while (dirty);
  return html;
};
const reset = () => {
  for (const hook of hooks) hook?.cleanup?.();
  hooks = []; effects = []; cursor = 0;
};
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const moreActions = () => nodes(lastTree).find(node => node.props?.className === 'conference-more-actions');
const moreToggle = () => nodes(lastTree).find(node => node.props?.className === 'conference-more-toggle');
const resizeCompact = value => { compactQuery.matches = value; for (const listener of queryListeners) listener(); };
let html = render();
assert.equal(chats.at(-1).visible, false, 'chat starts collapsed to leave room for the stage');
assert.equal(chats.at(-1).persistent, false, 'chat never reserves a permanent mobile column');
assert.match(html, /aria-label="Чат"/, 'collapsed chat has an accessible reopen button');
widgetChanged({ showChat: true });
html = render();
assert.equal(chats.at(-1).visible, true, 'the layout chat action opens the existing chat component');
assert.match(html, /data-workspace-chat="true"/, 'the workspace reflects open chat');
widgetChanged({ showChat: false });
html = render();
assert.equal(chats.at(-1).visible, false, 'chat can close without removing its component');
const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0] || '';
assert.match(footer, /data-presentation="true"/, 'presentation controls remain available with the transport');
assert.match(footer, /data-settings="true"/, 'device settings remain available with the transport');
assert.match(footer, /Mic[\s\S]*Camera/, 'microphone and camera controls remain adjacent and ordered');
assert.equal(moreToggle(), undefined, 'caster exposes sharing directly without a More menu');
assert.match(footer, /data-share="true"/, 'screen sharing stays mounted');
assert.match(footer, /data-transport="true"/, 'presentation actions stay mounted');
const leave = nodes(lastTree).find(node => node.props?.className === 'caster-toolbar-exit');
assert.equal(leave.props.onClick, base.onLeave, 'footer exit keeps the original leave callback');
resizeCompact(true);
html = render();
assert.match(html, /data-share="true"/, 'mobile keeps direct sharing mounted');
assert.match(html, /data-transport="true"/, 'mobile keeps direct presentation actions mounted');
resizeCompact(false);
html = render();
assert.match(html, /data-share="true"/, 'desktop retains sharing after mobile resize');
assert.doesNotMatch(footer, /screen-share-hint/, 'caster workspace preserves stage space');
reset();
const legacy = render({ workspaceLayout: false });
assert.match(legacy, /screen-share-hint/, 'other conference consumers retain sharing guidance');
assert.equal(chats.at(-1).visible, false);
console.log('PASS caster optional chat opens/closes, direct mounted sharing, and existing footer controls');

const track = (identity, source = 'camera', local = false) => ({
  source, participant: { identity, sid: 'sid-' + identity, name: identity, isLocal: local },
});
const local = track('guest-local', 'camera', true);
const studio = track('studio-panel-main');
const guest = track('guest-one');
const moderator = track('studio-moderator-one');
const screen = track('guest-one', 'screen_share');
const technical = track('private-talkback-one');
videoTracks = [local, studio, guest, moderator, screen, technical];
reset();
html = render();
let scene = scenes.at(-1);
assert.equal(scene.room, room, 'scene uses the existing media room');
assert.deepEqual(scene.items.map(item => item.identity), ['guest-local','studio-panel-main','guest-one','studio-moderator-one','guest-one'], 'normal conference includes allowed sources and excludes private technical identities');
assert.deepEqual(scene.items.map(item => item.kind), ['camera','camera','camera','camera','screen']);
assert.equal(scene.items[0].node.props.trackRef, local, 'local camera node retains its existing track');
const localId = scene.items[0].id;
html = render({ selfPreviewVisible: false, onToggleSelfPreview() {} });
scene = scenes.at(-1);
assert.equal(scene.items.length, 5, 'hiding local preview preserves every mounted source node');
assert.equal(scene.items[0].hidden, true);
assert.equal(scene.items[0].id, localId, 'hiding preview preserves source key');
assert.equal(scene.items[0].node.props.trackRef, local);
assert.match(html, /data-track-count="4"/, 'hidden self is excluded from layout count');
assert.doesNotMatch(html, /guest-self-preview-toggle/, 'preview control lives in existing monitoring settings');
html = render({ studioOnly: true, selfPreviewVisible: false, onToggleSelfPreview() {} });
scene = scenes.at(-1);
assert.deepEqual(scene.items.map(item => item.identity), ['guest-local','studio-panel-main'], 'studio-only keeps allowed Return and local preview, excluding guest sources');
assert.equal(scene.items[0].hidden, true);
assert.equal(scene.items[0].secondaryOnly, true, 'studio-only self preview never participates in primary selection');
assert.notEqual(scene.items[1].secondaryOnly, true, 'studio Return remains eligible for primary layout');
assert.match(html, /data-track-count="1"/);
assert.equal(chats.at(-1).visible, false, 'studio-only mode does not open room chat');
for (const visible of [true, false]) {
  videoTracks = [local];
  html = render({ studioOnly: true, selfPreviewVisible: visible, onToggleSelfPreview() {} });
  scene = scenes.at(-1);
  assert.equal(scene.items.length, 1, 'waiting keeps the local camera node mounted');
  assert.equal(scene.items[0].node.props.trackRef, local);
  assert.equal(scene.items[0].secondaryOnly, true, 'own PiP stays outside layout even when it is the sole mounted camera');
  assert.equal(scene.items[0].hidden, !visible, 'self preview visibility remains independent of secondary-only placement');
  assert.match(html, /data-track-count="0"/, 'own PiP never consumes a main stage cell');
  assert.match(html, /Ожидание эфира студии…/, 'no studio feed reports waiting with visible or hidden self preview');
}
reset();
assert.equal(queryListeners.size, 0, 'responsive listener cleans up when conference unmounts');
console.log('PASS allowed camera/screen sources, stable mounted self key, hidden layout count and studio waiting');
