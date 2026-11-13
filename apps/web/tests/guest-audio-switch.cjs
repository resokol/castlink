const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const audio = load('../lib/guest-audio.ts');
const { GuestAudioProfileSelector } = load('../components/GuestAudioProfileSelector.tsx', {
  react: { useId: () => 'processing-test' },
  '@/components/I18nProvider': { useI18n: () => ({ t: value => value }) },
});
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const render = props => nodes(GuestAudioProfileSelector({ onChange() {}, ...props }));
const control = props => render(props).find(node => node.props?.role === 'switch');

const initial = control({});
assert.ok(initial, 'microphone processing is exposed as a single switch');
assert.equal(initial.props.checked, false, 'new microphones start without noise or echo suppression');
assert.deepEqual(audio.guestAudioCaptureOptions({}), { autoGainControl: false, echoCancellation: false, noiseSuppression: false, voiceIsolation: false });
for (const [value, checked] of [[undefined, false], ['raw', false], ['speech', true]]) {
  let selected;
  const input = control({ value, onChange: profile => { selected = profile; } });
  assert.equal(input.props.checked, checked, 'switch reflects saved choices');
  input.props.onChange({ target: { checked: !checked } });
  const capture = audio.guestAudioCaptureOptions({ audioProfile: selected });
  assert.equal(capture.noiseSuppression, !checked);
  assert.equal(capture.echoCancellation, !checked, 'one switch changes both processing flags');
  assert.equal(capture.autoGainControl, false);
}
assert.equal(control({ disabled: true }).props.disabled, true);
assert.equal(control({ busy: true }).props.disabled, true);
assert.ok(render({ busy: true }).some(node => node.props?.role === 'status'), 'pending change has an announced status');
assert.equal(render({}).filter(node => node.props?.role === 'switch').length, 1);
assert.equal(render({}).some(node => node.type === 'select'), false);
console.log('PASS: one accessible processing switch defaults off, restores saved choices and controls noise/echo together');
