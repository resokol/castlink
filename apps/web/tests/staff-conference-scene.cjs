const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../components/RoomControlConsole.tsx', 'utf8');
const file = ts.createSourceFile('RoomControlConsole.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let items;
(function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'conferenceItems') items = node.initializer; ts.forEachChild(node, visit); })(file);
assert.ok(items, 'admin/moderator source cards use the shared conference scene');
const participant = identity => ({identity, name: identity, getTrackPublication: () => ({track: {}, isMuted: false})});
const context = {
  exports: {},
  require: name => name === 'react/jsx-runtime' ? {jsx: (type, props, key) => ({type, props, key}), jsxs: (type, props, key) => ({type, props, key})} : require(name),
  guests: [participant('guest-one')], staff: [participant('studio-moderator-one')], screens: [participant('guest-one'), participant('studio-panel-main')],
  room: {}, studioId: 'studio', roomName: 'room', monitor: {preferences: {}}, defaultMonitor: {video:true}, adminMonitorDefaults: {'studio-panel-main':{video:true}},
  selectedSource: 'camera:guest-one', limited:false, Track:{Source:{Camera:'camera',Microphone:'microphone'}},
  resolveParticipantRole:()=> 'moderator', t:key=>key, guestBusy:'', connected:true, copiedOutput:'', moderatorScope:'room', moveTargets:{}, rooms:[],
  screenOutputUrl:identity=>'screen:' + identity,
};
for (const name of ['ParticipantSourceCard','ParticipantPreview','GuestAudioMeter','MonitoringControls','TalkbackTargetButton','GuestCameraResolutionControl','RotateVideoButton','ParticipantRenameButton','StudioGuestRoleControls']) context[name] = name;
const code = ts.transpileModule('const items = ' + items.getText(file) + '; items;', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const result = vm.runInNewContext(code, context);
assert.deepEqual(Array.from(result, item => [item.id,item.identity,item.kind]), [
  ['camera:guest-one','guest-one','camera'], ['camera:studio-moderator-one','studio-moderator-one','camera'],
  ['screen:guest-one','guest-one','screen'], ['screen:studio-panel-main','studio-panel-main','screen'],
], 'each existing source appears once, with screen separate from camera and no added Return camera');
assert.ok(result.every(item=>item.node.type==='ParticipantSourceCard'));
assert.equal(result[0].node.props.preview.props.enabled,true);
assert.equal(result[0].node.props.selected,true,'existing roster selection is preserved');
assert.match(source, /<ConferenceScene items=\{conferenceItems\} room=\{room\}/, 'speaker events use the existing room');
assert.doesNotMatch(source, /getUserMedia|publishTrack|action:\s*"(?:claim|heartbeat|release)"/, 'staff scene remains receive-only');
console.log('PASS staff conference keeps exact camera/screen sources, roster selection, receive-only room and keyed source cards');


const primarySource = fs.readFileSync(__dirname + '/../components/StudioWorkspace.tsx', 'utf8');
const primaryFile = ts.createSourceFile('StudioWorkspace.tsx', primarySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let renderItems;
(function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(primaryFile) === 'renderItems') renderItems = node.initializer.expression;
  ts.forEachChild(node, visit);
})(primaryFile);
assert.ok(renderItems, 'primary studio delegates source layout after assembling persistent command controllers');
Object.assign(context, {
  ConferenceScene:'ConferenceScene', auxiliaryCameras:[{key:'camera:staff',identity:'staff',name:'Staff',self:false}],
  studioScreenSources:[{identity:'guest-one'},{identity:'studio-panel-main'}], monitoring:{preferences:{}},
  returnMonitor:{video:true}, focusedSourceIdentity:'guest-one', GuestPreview:'GuestPreview', PublishedSourcePreview:'PublishedSourcePreview',
  renderScreenSource:source=>({type:'screen',identity:source.identity}),
});
const renderCode = ts.transpileModule('(' + renderItems.getText(primaryFile) + ')', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const renderLayout = vm.runInNewContext(renderCode, { ...context });
const controller = {type:'persistent-controller'};
const scene = renderLayout([{guest:{identity:'guest-one'},node:controller}]);
assert.equal(scene.type,'ConferenceScene');
assert.equal(scene.props.items[0].node,controller,'the camera retains its existing controller node');
assert.deepEqual(Array.from(scene.props.items,item=>[item.id,item.kind]), [['guest-one','camera'],['camera:staff','camera'],['screen:guest-one','screen'],['screen:studio-panel-main','screen']]);
assert.equal(scene.props.room,context.room,'primary scene uses existing media room');
console.log('PASS primary scene retains controller nodes and separates all screens from guest and staff cameras');
