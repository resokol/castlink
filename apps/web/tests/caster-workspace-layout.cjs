const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');
const chats = [];
const { RoomConference } = load('../components/RoomConference.tsx', {
  '@/components/I18nProvider': { useI18n: () => ({ locale: 'ru', t: value => value }) },
  '@/components/ScreenShareButton': { ScreenShareButton: () => React.createElement('button', null, 'Share') },
  '@/components/RoomChat': { RoomChat: props => { chats.push(props); return React.createElement('section', { 'data-chat': true, hidden: !props.visible }, 'Chat'); } },
  '@livekit/components-react': {
    useRoomContext: () => ({}), useTracks: () => [], usePinnedTracks: () => [],
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
renderToStaticMarkup(React.createElement(RoomConference, props));
assert.equal(chats.at(-1).visible, false, 'other RoomConference consumers retain collapsed chat');
assert.notEqual(chats.at(-1).persistent, true);
console.log('PASS caster has persistent chat and bottom presentation/settings controls; legacy conference defaults unchanged');
