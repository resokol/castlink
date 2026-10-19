const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installDisplayCapture } = require('../src/capture.cjs');
function setup(chooseSource) {
  let handler; const frame = { url: 'https://studio.example/room' };
  const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  const session = { setDisplayMediaRequestHandler(value) { handler = value; } };
  const dispose = installDisplayCapture({ session, mainWindow: window, trustedOrigins: new Set(['https://studio.example']), chooseSource });
  return { request: (value) => new Promise(resolve => handler(value || { frame, videoRequested: true, audioRequested: true, userGesture: true }, resolve)), dispose, frame };
}
test('cancel denies capture and no audio/microphone is added', async () => {
  const cancelled = setup(async () => null);
  assert.deepEqual(await cancelled.request(), {});
  const chosen = setup(async () => ({ source: { id: 'screen:1:0', name: 'Screen' }, audio: true }));
  const result = await chosen.request();
  assert.equal(result.video.id, 'screen:1:0');
  assert.equal(result.audio, undefined, 'unverified loopback must remain disabled');
});
test('foreign frames, no user gesture, and changed origin are denied', async () => {
  let calls = 0;
  const state = setup(async () => { calls++; return { source: { id: 'screen:1:0' } }; });
  assert.deepEqual(await state.request({ frame: { url: state.frame.url }, videoRequested: true, userGesture: true }), {});
  assert.deepEqual(await state.request({ frame: state.frame, videoRequested: true, userGesture: false }), {});
  state.frame.url = 'https://evil.example';
  assert.deepEqual(await state.request(), {});
  assert.equal(calls, 0);
});
test('late selection after cancellation/navigation cannot leave capture running', async () => {
  let choose;
  const state = setup(() => new Promise(resolve => choose = resolve));
  const pending = state.request();
  state.dispose(); choose({ source: { id: 'screen:1:0' } });
  assert.deepEqual(await pending, {});
});
