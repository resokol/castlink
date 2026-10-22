const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load } = require('./load-typescript.cjs');
let current, calls = [], panels = [], pendingCapture, allowPanel = false;
const react = {
 useState(initial) { const scope = current, index = scope.cursor++; if (!(index in scope.hooks)) scope.hooks[index] = typeof initial === 'function' ? initial() : initial; return [scope.hooks[index], value => { const next = typeof value === 'function' ? value(scope.hooks[index]) : value; if (next !== scope.hooks[index]) { scope.hooks[index] = next; scope.dirty = true; } }]; },
 useRef(initial) { const index = current.cursor++; return current.hooks[index] ??= { current: initial }; },
 useEffect(callback, deps) { const scope = current, index = scope.cursor++, previous = scope.hooks[index]; if (!previous || deps.some((value, offset) => value !== previous.deps[offset])) scope.effects.push(() => { previous?.cleanup?.(); scope.hooks[index] = { deps, cleanup: callback() }; }); },
};
function renderer(component) { const scope = { hooks: [], effects: [], cursor: 0 }; return { render(props) { let tree, cycles = 0; do { assert.ok(++cycles < 20); current = scope; scope.cursor = 0; scope.dirty = false; tree = component(props); while (scope.effects.length) scope.effects.shift()(); } while (scope.dirty); return tree; }, unmount() { for (const hook of scope.hooks) hook?.cleanup?.(); } }; }
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const button = (tree, label) => nodes(tree).find(node => node.type === 'button' && node.props.children === label);
const RoomEvent = new Proxy({}, { get: (_, key) => key });
const makeRoom = () => { const room = new EventEmitter(); room.state = 'connected'; room.track = undefined; room.localParticipant = { getTrackPublication: source => source === 'screen_share' && room.track ? { track: { mediaStreamTrack: room.track } } : undefined, async setScreenShareEnabled(enabled) { calls.push(['sdk-stop', room, enabled]); room.track = undefined; room.emit(RoomEvent.LocalTrackUnpublished); } }; return room; };
const activeTrack = () => Object.assign(new EventTarget(), { readyState: 'live' });
const start = async (room, isCurrent) => { calls.push(['capture', room]); const accepted = await new Promise(resolve => pendingCapture = resolve); if (!accepted || !isCurrent()) return false; room.track = activeTrack(); room.emit(RoomEvent.LocalTrackPublished); return true; };
Object.defineProperty(global, 'navigator', { configurable: true, value: { mediaDevices: { getDisplayMedia() {} } } });
global.window = { setTimeout: () => 1, clearTimeout() {}, documentPictureInPicture: {} };
const { ScreenShareButton } = load('../components/ScreenShareButton.tsx', {
 react,
 './CoPresentationNavigation': { useCoPresentationNavigation: () => undefined, ownerSurfaceMatches: () => false },
 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
 'livekit-client': { RoomEvent, Track: { Source: { ScreenShare: 'screen_share' } } },
 '@livekit/components-react': { ScreenShareIcon() {}, ScreenShareStopIcon() {} },
 '@/components/I18nProvider': { useI18n: () => ({ locale: 'ru', t: value => value }) },
 '@/lib/i18n/workspaces': { translateWorkspaceMessage: (_, value) => value },
 '@/lib/screen-share': { enableRoomScreenShare: start, enableStudioScreenShare: start, setRoomScreenShareOutputMuted() {}, async stopStudioScreenShare(room) { calls.push(['studio-stop', room]); room.track = undefined; room.emit(RoomEvent.LocalTrackUnpublished); } },
 '@/lib/screen-share-stop-panel': { documentPictureInPictureApi: host => host.documentPictureInPicture, createScreenShareStopPanel(options) { const panel = { ...options, disposed: false, opens: 0, async open() { panel.opens++; calls.push(['pip', options.isSharing()]); options.onStateChange(allowPanel ? 'open' : 'closed'); return allowPanel; }, sync() { if (!options.isSharing()) options.onStateChange('closed'); }, setLabels() {}, setSuppressed() {}, dispose() { panel.disposed = true; } }; panels.push(panel); return panel; } },
});
const settle = async () => { for (let index = 0; index < 6; index++) await new Promise(resolve => setImmediate(resolve)); };
(async () => {
 const room = makeRoom(), view = renderer(ScreenShareButton); let tree = view.render({ room });
 button(tree, 'Показать экран / приложение').props.onClick(); assert.equal(calls[0][0], 'capture'); assert.equal(panels.at(-1)?.opens ?? 0, 0, 'PiP never consumes activation before capture');
 pendingCapture(true); await settle(); tree = view.render({ room });
 assert.equal(panels.at(-1).opens, 1, 'automatic open is attempted only after confirmed capture'); assert.equal(calls.find(call => call[0] === 'pip')[1], true);
 assert.ok(button(tree, 'Показать панель остановки'), 'activation rejection keeps an explicit reopen action');
 button(tree, 'Показать панель остановки').props.onClick(); await settle(); tree = view.render({ room }); assert.ok(nodes(tree).some(node => node.props?.role === 'status' && String(node.props.children).includes('Не удалось открыть')));
 allowPanel = true; button(tree, 'Показать панель остановки').props.onClick(); await settle(); tree = view.render({ room });
 await panels.at(-1).stop(); await settle(); assert.equal(calls.filter(call => call[0] === 'sdk-stop').length, 1); assert.equal(calls.some(call => call[0] === 'studio-stop'), false, 'ordinary panel stop uses existing room stop path');
 view.unmount();
 calls = []; const primary = makeRoom(); primary.track = activeTrack(); const studio = renderer(ScreenShareButton); studio.render({ room: primary, getOutputMuted: () => false }); await panels.at(-1).stop(); assert.equal(calls.filter(call => call[0] === 'studio-stop').length, 1); assert.equal(calls.some(call => call[0] === 'sdk-stop'), false); studio.unmount();
 calls = []; const native = makeRoom(); native.track = activeTrack(); const nativeView = renderer(ScreenShareButton); nativeView.render({ room: native }); native.track.readyState = 'ended'; native.track.dispatchEvent(new Event('ended')); tree = nativeView.render({ room: native }); assert.ok(button(tree, 'Показать экран / приложение'), 'native ended track clears sharing without waiting for an SDK publication event: ' + JSON.stringify(nodes(tree).filter(node => node.type === 'button').map(node => node.props.children)));
 native.track = activeTrack(); native.emit(RoomEvent.LocalTrackPublished); native.state = 'disconnected'; native.emit(RoomEvent.Disconnected); tree = nativeView.render({ room: native }); assert.equal(nodes(tree).find(node => node.type === 'button').props.disabled, true); nativeView.unmount();
 calls = []; const oldRoom = makeRoom(), newRoom = makeRoom(); oldRoom.track = activeTrack(); const changing = renderer(ScreenShareButton); changing.render({ room: oldRoom }); const stalePanel = panels.at(-1); changing.render({ room: newRoom }); await stalePanel.stop(); assert.equal(calls.some(call => call[0].endsWith('stop')), false, 'stale room callback cannot stop another room or camera'); assert.equal(stalePanel.disposed, true); changing.unmount();
 calls = []; const previous = makeRoom(), next = makeRoom(), switching = renderer(ScreenShareButton); tree = switching.render({ room: previous }); button(tree, 'Показать экран / приложение').props.onClick(); const previousCapture = pendingCapture, previousPanel = panels.at(-1); tree = switching.render({ room: next }); button(tree, 'Показать экран / приложение').props.onClick(); const nextCapture = pendingCapture, nextPanel = panels.at(-1); previousCapture(true); await settle(); tree = switching.render({ room: next }); assert.equal(nodes(tree).find(node => node.type === 'button').props.disabled, true, 'old capture completion cannot clear the new room pending operation'); assert.equal(previousPanel.opens, 0); nextCapture(true); await settle(); assert.equal(nextPanel.opens, 1); switching.unmount();
 calls = []; const cancelled = makeRoom(), cancelView = renderer(ScreenShareButton); tree = cancelView.render({ room: cancelled }); button(tree, 'Показать экран / приложение').props.onClick(); const cancelledPanel = panels.at(-1); cancelView.unmount(); pendingCapture(true); await settle(); assert.equal(cancelledPanel.opens, 0, 'unmounted pending capture never opens PiP');
 const denied = makeRoom(), denyView = renderer(ScreenShareButton); tree = denyView.render({ room: denied }); button(tree, 'Показать экран / приложение').props.onClick(); const deniedPanel = panels.at(-1); pendingCapture(false); await settle(); assert.equal(deniedPanel.opens, 0, 'cancelled picker never opens PiP'); denyView.unmount();
 delete window.documentPictureInPicture; const unsupported = makeRoom(); unsupported.track = activeTrack(); const fallback = renderer(ScreenShareButton); tree = fallback.render({ room: unsupported }); assert.equal(button(tree, 'Остановить показ экрана').props.disabled, false, 'unsupported PiP keeps the existing screen stop action'); assert.equal(button(tree, 'Показать панель остановки'), undefined); assert.ok(nodes(tree).some(node => node.props?.role === 'status' && String(node.props.children).includes('не поддерживает плавающую'))); fallback.unmount();
 console.log('screen share stop panel actual button bindings: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
