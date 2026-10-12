const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

let cameraEnabled = false;
let pending = false, toggleOptions;
const toggle = () => {};
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === '@livekit/components-react') return {
    useLocalParticipant: () => ({ isCameraEnabled: cameraEnabled }),
    useTrackToggle: options => { toggleOptions = options; return { pending, buttonProps: { className: 'lk-button', disabled: pending, onClick: toggle, 'aria-pressed': cameraEnabled } }; },
  };
  if (name === 'livekit-client') return { Track: { Source: { Camera: 'camera' } } };
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  return originalLoad.call(this, name, ...args);
};
let GuestCameraButton;
try {
  const filename = require.resolve('../components/GuestCameraButton.tsx');
  const component = new Module(filename, module);
  component.paths = module.paths;
  component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  ({ GuestCameraButton } = component.exports);
} finally { Module._load = originalLoad; }

let error = '';
const render = (disabled = false) => GuestCameraButton({ disabled, onError: value => { error = value; } });
let button = render();
assert.equal(button.type, 'button');
assert.equal(button.props.onClick, toggle, 'the button retains the SDK camera toggle');
assert.equal(button.props['aria-label'], 'Включить камеру');
assert.equal(button.props.children[1].props.children, 'Камера выключена');
toggleOptions.onDeviceError(new Error('Permission denied'));
const failure = error;
assert.ok(failure.includes('разрешение браузера'));
// LiveKit invokes onChange again when a parent render supplies a new callback,
// even when the failed acquisition left the actual enabled state unchanged.
button = render();
toggleOptions.onChange(false, false);
assert.equal(error, failure, 'a rerender/observer notification must retain the camera failure');
cameraEnabled = true;
button = render();
toggleOptions.onChange(true, false);
assert.equal(error, failure, 'an unsolicited state notification does not confirm the failed user action');
assert.equal(button.props['aria-label'], 'Выключить камеру');
assert.equal(button.props.children[1].props.children, 'Камера');
toggleOptions.onChange(true, true);
assert.equal(error, '', 'a confirmed user camera change clears the failure');
assert.equal(render(true).props.disabled, true, 'transition lock overrides SDK disabled:false');
assert.equal(render().props.disabled, false, 'idle camera can toggle after the transition');
pending = true;
assert.equal(render().props.disabled, true, 'the SDK pending lock also remains effective');
console.log('PASS: camera errors survive observer rerenders, actual SDK labels/toggle retained, transition and pending locks enforced');
