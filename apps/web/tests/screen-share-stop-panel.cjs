const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { createScreenShareStopPanel, documentPictureInPictureApi } = load('../lib/screen-share-stop-panel.ts');
class Element extends EventTarget {
  constructor(tag) { super(); this.tagName = tag; this.children = []; this.textContent = ''; this.style = {}; this.attributes = {}; }
  append(...children) { for (const node of children) { node.parent=this; this.children.push(node); } }
  remove() { if(this.parent) this.parent.children=this.parent.children.filter(node=>node!==this); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  click() { this.dispatchEvent(new Event('click')); }
}
class PipWindow extends EventTarget {
  constructor() { super(); this.closed = false; this.closes = 0; this.document = { title: '', documentElement: new Element('html'), head: new Element('head'), body: new Element('body'), createElement: tag => new Element(tag) }; }
  close() { this.closes++; this.closed = true; this.dispatchEvent(new Event('pagehide')); }
  focus() { this.focused = true; }
}
const labels = { locale: 'ru', title: 'Stop panel', stop: 'STOP SHARING', stopping: 'Stopping', stopError: 'Stop failed. Retry.' };
const find = (node,tag) => node.tagName===tag ? node : node.children.map(child=>find(child,tag)).find(Boolean);
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  assert.equal(documentPictureInPictureApi(undefined), undefined);
  assert.equal(documentPictureInPictureApi({}), undefined);
  assert.equal(documentPictureInPictureApi({ documentPictureInPicture: { requestWindow: true } }), undefined);
  let sharing = true, requests = 0, stops = 0, release, failStop = false, finishStop;
  const windows = [], states = [];
  const api = { requestWindow(options) { requests++; assert.deepEqual(options, { width: 420, height: 56, preferInitialWindowPlacement: true }); return new Promise(resolve => release = () => { const window = new PipWindow(); windows.push(window); resolve(window); }); } };
  assert.equal(documentPictureInPictureApi({ documentPictureInPicture: api }), api);
  const panel = createScreenShareStopPanel({ api, labels, isSharing: () => sharing, onStateChange: value => states.push(value), stop: async () => { stops++; if (failStop) throw Error('denied'); await new Promise(resolve => finishStop = resolve); sharing = false; } });
  const first = panel.open(); const duplicate = panel.open(); assert.equal(requests, 1, 'pending opens cannot request a second PiP window'); release(); assert.equal(await first, true); assert.equal(await duplicate, true);
  const firstWindow = windows.at(-1), button = find(firstWindow.document.body,'button');
  assert.equal(button.tagName, 'button'); assert.equal(button.textContent, labels.stop);
  assert.ok(find(firstWindow.document.body,'style').textContent.includes('#bd3443'));
  assert.equal(firstWindow.document.documentElement.lang, 'ru');
  await panel.open(); assert.equal(requests, 1); assert.equal(firstWindow.focused, true);
  panel.setLabels({ ...labels, stop: '停止共享屏幕', locale: 'zh-CN' }); assert.equal(button.textContent, '停止共享屏幕');
  firstWindow.close(); assert.equal(stops, 0, 'closing PiP only hides the panel'); assert.equal(sharing, true);
  const reopening = panel.open(); release(); await reopening;
  const reopened = windows.at(-1), stop = find(reopened.document.body,'button');
  stop.click(); stop.click(); assert.equal(stops, 1, 'double click issues one stop'); assert.equal(stop.disabled, true);
  finishStop(); await settle(); assert.equal(reopened.closed, true, 'confirmed media stop closes the panel');
  sharing = true; failStop = true; const failureOpen = panel.open(); release(); await failureOpen;
  const failedWindow = windows.at(-1); find(failedWindow.document.body,'button').click(); await settle();
  assert.equal(failedWindow.closed, false); assert.equal(find(failedWindow.document.body,'button').disabled, false, 'a failed stop is retryable');
  assert.equal(find(failedWindow.document.body,'div').children.find(node=>node.attributes.role==='alert').textContent, labels.stopError);
  sharing = false; panel.sync(); assert.equal(failedWindow.closed, true, 'native browser stop or disconnect closes the window');
  sharing = true; const late = panel.open(); sharing = false; panel.sync(); release(); assert.equal(await late, false); assert.equal(windows.at(-1).closed, true, 'late window after stop is immediately closed');
  sharing = true; const unmounted = panel.open(); panel.dispose(); release(); assert.equal(await unmounted, false); assert.equal(windows.at(-1).closed, true, 'late room/unmount result cannot leave an orphan panel');
  assert.equal(await panel.open(), false);
  assert.equal(states.at(-1), 'closed');
  const unsupported = createScreenShareStopPanel({ labels, isSharing: () => true, stop: async () => { throw Error('must not stop'); } });
  assert.equal(await unsupported.open(), false);
  const rejected = createScreenShareStopPanel({ api: { requestWindow: async () => { throw Error('No user activation'); } }, labels, isSharing: () => true, stop: async () => {} });
  assert.equal(await rejected.open(), false, 'activation rejection is a quiet fallback');
  console.log('screen share stop panel actual DOM/controller: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
