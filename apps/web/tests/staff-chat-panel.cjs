const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
let slots = [], cursor = 0, effects = [], dirty = false, renderedScope;
const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
const react = {
  useState(initial) { const store = slots, index = cursor++; if (!(index in store)) store[index] = initial; return [store[index], value => { store[index] = typeof value === 'function' ? value(store[index]) : value; dirty = true; }]; },
  useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
  useId() { const index = cursor++; return slots[index] ??= `chat-test-${index}`; },
  useEffect(callback, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) { const old = slots[index]; slots[index] = { deps }; effects.push(() => { old?.cleanup?.(); slots[index].cleanup = callback(); }); } },
};
const ChatEntry = () => null;
const { StaffChatPanel, StaffChatTab } = load('../components/StaffChatPanel.tsx', {
  react,
  'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) },
  '@livekit/components-react': { ChatEntry },
  '@/components/I18nProvider': { useI18n: () => ({ t: (text, params) => text.replace(/\{(\w+)\}/g, (_, key) => params[key]) }) },
});
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const unmount = () => { for (const slot of slots) slot?.cleanup?.(); slots = []; effects = []; cursor = 0; };
let closes = 0, preference, calls = [], resolveSend, rejectSend;
const chat = { scope: 'one', messages: [{ id: 'first', message: '<script>literal</script>', timestamp: 1 }], connected: false, showUnread: true, unread: 123, badge: '99+', isSending: false, setShowUnread: value => preference = value, send: text => { calls.push(text); return new Promise((resolve, reject) => { resolveSend = resolve; rejectSend = reject; }); } };
let props = { chat, visible: true, onClose: () => closes++ };
function render() {
  const wrapper = StaffChatPanel(props);
  if (renderedScope !== wrapper.key) { unmount(); renderedScope = wrapper.key; }
  let tree, cycles = 0;
  do { assert.ok(++cycles < 10); dirty = false; cursor = 0; effects = []; tree = wrapper.type(wrapper.props); while (effects.length) effects.shift()(); } while (dirty);
  return tree;
}
const input = tree => nodes(tree).find(node => node.type === 'input' && node.props.type !== 'checkbox');
const form = tree => nodes(tree).find(node => node.type === 'form');
const submit = tree => form(tree).props.onSubmit({ preventDefault() {} });
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  let tree = render();
  assert.equal(input(tree).props.disabled, true, 'disconnected chat cannot send');
  assert.ok(nodes(tree).some(node => node.props?.role === 'status'));
  assert.equal(nodes(tree).find(node => node.type === ChatEntry).props.entry, chat.messages[0], 'message content goes through the existing ChatEntry');
  nodes(tree).find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: false } }); assert.equal(preference, false);
  chat.connected = true; tree = render(); input(tree).props.onChange({ target: { value: '  hello  ' } }); tree = render(); submit(tree); tree = render(); submit(tree);
  assert.deepEqual(calls, ['hello'], 'pending send cannot be submitted twice'); assert.equal(input(tree).props.disabled, true);
  resolveSend(); await settle(); tree = render(); assert.equal(input(tree).props.value, '');
  input(tree).props.onChange({ target: { value: 'retry me' } }); tree = render(); submit(tree); rejectSend(Error('synthetic send failure')); await settle(); tree = render();
  assert.equal(input(tree).props.value, 'retry me', 'failed sends retain the draft'); assert.ok(nodes(tree).some(node => node.props?.role === 'alert'));
  submit(tree); tree = render();
  props = { ...props, chat: { ...chat, scope: 'two', messages: [] } }; tree = render();
  input(tree).props.onChange({ target: { value: 'new room draft' } }); tree = render(); rejectSend(Error('late old-room failure')); await settle(); tree = render();
  assert.equal(input(tree).props.value, 'new room draft'); assert.equal(nodes(tree).some(node => node.props?.role === 'alert'), false, 'late old-room completion does not affect the new room');
  nodes(tree).find(node => node.type === 'button' && node.props['aria-label'] === 'Закрыть чат').props.onClick(); assert.equal(closes, 1);
  props = { ...props, visible: false }; tree = render(); assert.equal(tree.props.hidden, true); assert.equal(nodes(tree).find(node => node.type === 'ul').props['aria-live'], 'off');
  const tab = StaffChatTab({ chat, active: false, onOpen() {} });
  assert.equal(tab.props['aria-label'], 'Чат: 123 новых сообщений');
  assert.ok(nodes(tab).some(node => node.props?.children === '99+' && node.props['aria-hidden'] === 'true'));
  let clears=0, finishClear;
  props={...props,visible:true,chat:{...props.chat,clear:()=>{clears++;return new Promise(resolve=>finishClear=resolve);},isClearing:false}};
  tree=render();const button=(label)=>nodes(tree).find(node=>node.type==='button'&&node.props.children===label);
  button('Очистить чат').props.onClick();tree=render();assert.equal(clears,0,'opening confirmation does not erase history');
  button('Отмена').props.onClick();tree=render();assert.equal(clears,0,'cancel preserves history');
  button('Очистить чат').props.onClick();tree=render();button('Очистить у всех').props.onClick();button('Очистить у всех').props.onClick();assert.equal(clears,1,'double click clears only once');
  finishClear();await settle();tree=render();assert.ok(nodes(tree).some(node=>node.props?.role==='status'&&node.props.children==='Чат очищен у всех участников.'));
  assert.equal(input(tree).props.value,'new room draft','clear preserves unsent draft');
  unmount(); console.log('staff chat actual panel: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
