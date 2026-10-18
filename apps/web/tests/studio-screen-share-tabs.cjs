const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Evaluate the actual workspace JSX prop for every tab, rather than a duplicate layout.
const file = ts.createSourceFile('StudioWorkspace.tsx', fs.readFileSync(`${__dirname}/../components/StudioWorkspace.tsx`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression;
function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(file) === 'headerActions') expression = node.initializer.expression;
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(expression, 'workspace publishing controls exist');
const code = ts.transpileModule(`result = (${expression.getText(file)});`, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const room = {}, mutedRef = { current: false }, privateRef = { current: false };
const context = {
  React: { createElement: (type, props) => ({ type, props }) },
  StudioReturnPublishingControls: 'publishing-controls', ScreenShareButton: 'screen-share',
  room, outputMuted: false, outputMutedRef: mutedRef, studioOnly: false, modeBusy: false,
  privateTalkActive: false, privateTalkActiveRef: privateRef,
  studioRole: 'primary', sessionToken: 'test', onAir: true, airBusy: false,
  videoModeBusy: false, returnActive: true, previewReady: true,
};
for (const activeTab of ['studio', 'multiview', 'participants', 'statistics', 'servers', 'studio']) {
  const sandbox = { ...context, activeTab };
  vm.runInNewContext(code, sandbox);
  assert.equal(sandbox.result?.type, 'publishing-controls', `${activeTab}: publishing controls must remain mounted`);
  assert.equal(sandbox.result.props.screenShare?.type, 'screen-share', `${activeTab}: screen share must remain mounted`);
  assert.equal(sandbox.result.props.screenShare.props.room, room, 'keep the same room');
  mutedRef.current = true;
  assert.equal(sandbox.result.props.screenShare.props.getOutputMuted(), true, 'hidden controls still read current output mute');
  mutedRef.current = false;
  privateRef.current = true;
  assert.equal(sandbox.result.props.screenShare.props.getOutputMuted(), false, 'private conversation never gates display audio');
  privateRef.current = false;
}
console.log('STUDIO_SCREEN_SHARE_TABS_PASS');
