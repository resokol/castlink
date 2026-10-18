const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
let slots = [], cursor = 0, effects = [], dirty = false;
const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
const react = {
  useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (next !== slots[index]) { slots[index] = next; dirty = true; } }]; },
  useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
  useMemo(factory, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() }; return slots[index].value; },
  useEffect(callback, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) { const old = slots[index]; slots[index] = { deps, callback }; effects.push(() => { old?.cleanup?.(); slots[index].cleanup = callback(); }); } },
};
const optionsCalls = [], writes = [];
let restoringPreference = true;
let sdkMessages = [], sdkSending = false;
global.window = { localStorage: { getItem: () => 'false', setItem: (key, value) => writes.push([key, value]) } };
const { useStaffRoomChat } = load('../lib/use-staff-room-chat.ts', {
  react,
  'livekit-client': { ConnectionState: { Connected: 'connected' } },
  '@livekit/components-react': { useChat(options) { optionsCalls.push(options); return { chatMessages: sdkMessages, isSending: sdkSending, send: async text => text }; }, useConnectionState: room => room.state },
});
let props = { room: { state: 'connected', localParticipant: { identity: 'staff' } }, scope: '["studio","one"]', visible: false };
let hook;
function render(strictMount = false) {
  let cycles = 0;
  do {
    assert.ok(++cycles < 20, 'effects converge'); dirty = false; cursor = 0; effects = [];
    hook = useStaffRoomChat(props);
    if (restoringPreference) assert.ok(writes.every(([, value]) => value === 'false'), 'stored false is never overwritten by the initial true default');
    const pending = effects; effects = []; pending.forEach(effect => effect());
    if (strictMount) { strictMount = false; for (const slot of slots) if (slot?.callback) { slot.cleanup?.(); slot.cleanup = slot.callback(); } }
  } while (dirty);
  return hook;
}
const msg = (id, timestamp, identity = 'guest') => ({ id, timestamp, message: id, from: { identity } });
render(true);
assert.equal(hook.showUnread, false);
const stableOptions = optionsCalls[0];
sdkMessages = [msg('first', 1)]; render();
assert.equal(hook.unread, 1); assert.equal(hook.badge, '');
assert.ok(optionsCalls.every(options => options === stableOptions), 'unread/preference renders preserve the actual useChat options object');
hook.setShowUnread(true); writes.length = 0; restoringPreference = false;
// A normal enabled preference is saved only after the initial storage restore.
window.localStorage.setItem = (key, value) => writes.push([key, value]);
render(); assert.equal(hook.badge, '1'); assert.ok(writes.some(([, value]) => value === 'true'));
sdkMessages = [msg('first', 1), msg('own', 2, 'staff')]; render(); assert.equal(hook.unread, 1);
sdkMessages = []; render(); assert.equal(hook.messages.length, 2, 'SDK reset on reconnect does not erase retained session history');
sdkMessages = [msg('first', 1)]; render(); assert.equal(hook.unread, 1);
props = { ...props, visible: true }; render(); assert.equal(hook.unread, 0);
props = { ...props, visible: false }; sdkMessages = [msg('next', 3)]; render(); assert.equal(hook.unread, 1);
hook.setShowUnread(false); render(); assert.equal(hook.badge, ''); assert.equal(hook.unread, 1);
props = { ...props, visible: true }; render(); assert.equal(hook.unread, 0, 'opening clears unread even with counters disabled');
props = { ...props, visible: false, scope: '["studio","two"]' }; render();
assert.equal(hook.messages.length, 0); assert.equal(hook.unread, 0, 'scope change clears before a reused Room emits a new snapshot');
sdkMessages = [msg('next', 3), msg('new scope', 4)]; render();
assert.deepEqual(hook.messages.map(message => message.id), ['new scope']); assert.equal(hook.unread, 1);
props = { ...props, room: { state: 'disconnected', localParticipant: { identity: 'staff' } }, scope: '["studio","three"]' }; render();
assert.equal(hook.messages.length, 0); assert.equal(hook.connected, false);
assert.notEqual(optionsCalls.at(-1), stableOptions, 'room identity changes replace options exactly when needed');
for (const slot of slots) slot?.cleanup?.();
console.log('staff room chat actual hook bindings: PASS');
