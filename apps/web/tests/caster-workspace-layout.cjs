const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');
const chats = [];
let videoTracks = [];
const { RoomConference } = load('../components/RoomConference.tsx', {
  '@/components/I18nProvider': { useI18n: () => ({ locale: 'ru', t: value => value }) },
  '@/components/ScreenShareButton': { ScreenShareButton: () => React.createElement('button', null, 'Share') },
  '@/components/RoomChat': { RoomChat: props => { chats.push(props); return React.createElement('section', { 'data-chat': true, hidden: !props.visible }, 'Chat'); } },
  '@livekit/components-react': {
    useRoomContext: () => ({}), useTracks: sources => typeof sources[0] === 'object' ? videoTracks : [], usePinnedTracks: () => [],
    TrackLoop: ({ tracks }) => React.createElement('div', { 'data-track-count-test': tracks.length }),
    useCreateLayoutContext: () => ({ widget: { state: { showChat: false }, dispatch() {} } }),
    LayoutContextProvider: ({ children }) => children,
    ChatToggle: ({ children }) => React.createElement('button', null, children),
  },
});
const props = { studioOnly: false, onLeave() {}, microphoneControl: React.createElement('button', null, 'Mic'), cameraControl: React.createElement('button', null, 'Camera') };
const extraControls = React.createElement('button', { 'data-presentation': true }, 'Presentation');
const settingsControl = React.createElement('button', { 'data-settings': true }, 'Settings');
const html = renderToStaticMarkup(React.createElement(RoomConference, { ...props, workspaceLayout: true, extraControls, settingsControl }));
assert.equal(chats.at(-1).visible, true, 'caster chat is visible immediately, without a toggle');
assert.equal(chats.at(-1).persistent, true, 'caster chat keeps its dedicated column');
const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0] || '';
assert.match(footer, /data-presentation="true"/, 'presentation actions belong in the bottom control panel');
assert.match(footer, /data-settings="true"/, 'device settings are reachable from the bottom control panel');
assert.doesNotMatch(footer, /screen-share-hint|Кнопка показа экрана позволяет/, 'caster stage reclaims the explanatory text row');
const legacy = renderToStaticMarkup(React.createElement(RoomConference, props));
assert.match(legacy, /screen-share-hint/, 'legacy conference consumers retain screen sharing guidance');
assert.equal(chats.at(-1).visible, false, 'other RoomConference consumers retain collapsed chat');
assert.notEqual(chats.at(-1).persistent, true);
assert.doesNotMatch(legacy, /--conference-fit-/, 'legacy consumers keep their existing gallery geometry');
for (const [count, columns, rows] of [[1,1,1],[2,2,1],[3,2,2],[4,2,2],[6,3,2],[10,4,3]]) {
  videoTracks = Array.from({ length: count }, (_, index) => ({ source: 'camera', participant: { identity: `guest-qa-${index}` } }));
  const grid = renderToStaticMarkup(React.createElement(RoomConference, { ...props, workspaceLayout: true }));
  assert.match(grid, new RegExp(`--conference-fit-columns:${columns}(?:;|\")`), `${count} tracks have a bounded desktop column count`);
  assert.match(grid, new RegExp(`--conference-fit-rows:${rows}(?:;|\")`), `${count} tracks reserve every row within the available height`);
}
console.log('PASS caster has persistent chat and bottom presentation/settings controls; legacy conference defaults unchanged');

videoTracks = [
  { source: 'camera', participant: { identity: 'guest-local', isLocal: true } },
  { source: 'camera', participant: { identity: 'studio-panel-main', isLocal: false } },
];
let monitored = renderToStaticMarkup(React.createElement(RoomConference, { ...props, workspaceLayout: true, studioOnly: true, selfPreviewVisible: false, onToggleSelfPreview() {} }));
assert.match(monitored, /data-track-count-test="2"/, 'studio-only mode retains mounted local camera alongside studio');
assert.match(monitored, /data-track-count="1"/, 'self PiP does not consume a gallery cell');
assert.match(monitored, /Показать свой предпросмотр/, 'hidden personal preview has a visible reopen action');
monitored = renderToStaticMarkup(React.createElement(RoomConference, { ...props, workspaceLayout: true, selfPreviewVisible: false }));
assert.match(monitored, /data-track-count="1"/, 'hidden local camera does not reserve an empty normal gallery cell');
videoTracks = videoTracks.slice(0, 1);
monitored = renderToStaticMarkup(React.createElement(RoomConference, { ...props, workspaceLayout: true, studioOnly: true }));
assert.match(monitored, /Ожидание эфира студии…/, 'missing studio still reports waiting with a self preview mounted');
assert.match(monitored, /data-track-count-test="1"/, 'waiting notice preserves mounted self preview');
console.log('PASS studio-only preview filtering, hidden gallery count and waiting feed state');

