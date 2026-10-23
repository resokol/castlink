const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load } = require('./load-typescript.cjs');
let cursor = 0;
const hooks = [], effects = [], calls = [], errors = [];
let fail = false;
const controller = { async setEffect(effect) { calls.push(effect); if (fail) throw Error('effect failed'); }, stop() {} };
const react = {
  useState(initial) { const i = cursor++; hooks[i] ??= { value: initial }; return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next; }]; },
  useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
  useId() { cursor++; return 'camera-test'; },
  useEffect(fn, deps) { const i = cursor++, old = hooks[i]; if (old && deps?.every((value, j) => Object.is(value, old.deps?.[j]))) return; effects.push(() => { old?.cleanup?.(); hooks[i] = { deps, cleanup: fn() }; }); },
};
const room = new EventEmitter(); room.localParticipant = { isCameraEnabled: true };
const { GuestCodecCameraButton } = load('../components/GuestCodecCameraButton.tsx', {
  react, '@/components/I18nProvider': { useI18n: () => ({ t: value => value }) },
  '@/lib/guest-video-codec': { setGuestCameraEnabled() { throw Error('slider started capture'); } },
  '@/lib/guest-camera-effects': { watchGuestCameraEffects: () => controller, cameraBlurRadius: value => value ?? 10 },
});
function render(disabled = false) {
  cursor = 0;
  const tree = GuestCodecCameraButton({ room, choicesRef: { current: {} }, generation: { current: 1 }, disabled, onError: value => errors.push(value) });
  while (effects.length) effects.shift()();
  return tree;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
}
const slider = disabled => find(render(disabled), node => node.type === 'input' && node.props.type === 'range');
const settle = () => new Promise(resolve => setImmediate(resolve));
const debounce = () => new Promise(resolve => setTimeout(resolve, 150));
(async () => {
  try {
    render();
    assert.equal(slider(), undefined, 'strength is disclosed only for background blur');
    const blur = find(render(), node => node.type === 'input' && node.props.type === 'radio' && node.props.onChange && !node.props.checked);
    blur.props.onChange(); await settle();
    const control = slider();
    assert(control, 'background blur exposes a strength slider');
    assert.equal(control.props['aria-label'], 'Сила размытия');
    assert.equal(control.props.min, 1); assert.equal(control.props.max, 30); assert.equal(control.props.value, 10);
    control.props.onChange({ target: { value: '14' } }); slider();
    slider().props.onChange({ target: { value: '24' } }); slider();
    await debounce(); await settle(); render();
    assert.deepEqual(calls.at(-1), { mode: 'blur', blurRadius: 24 }, 'a drag applies its latest radius');
    assert.equal(calls.length, 2, 'coalesced drag avoids unnecessary shader updates');
    assert.equal(slider().props.value, 24);
    assert.equal(slider(true).props.disabled, true, 'room transition locks the strength control');
    render();
    fail = true; slider().props.onChange({ target: { value: '29' } }); render();
    await debounce(); await settle(); render();
    assert.equal(slider().props.value, 24, 'failed update restores the last confirmed strength');
    assert.equal(errors.at(-1), 'effect failed');
    await debounce(); render(); assert.equal(calls.length, 3, 'a failed adjustment does not retry forever');
    console.log('PASS camera blur slider: disclosure, label, bounds, coalesced drag, transition lock and failure recovery');
  } finally { for (const hook of hooks) hook?.cleanup?.(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
