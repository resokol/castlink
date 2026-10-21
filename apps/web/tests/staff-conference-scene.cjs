const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../components/RoomControlConsole.tsx', 'utf8');
const file = ts.createSourceFile('RoomControlConsole.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let items;
(function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'conferenceItems') items = node.initializer; ts.forEachChild(node, visit); })(file);
assert.ok(items, 'admin/moderator keeps its existing authorized source cards');
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
let consoleDeck;
(function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === 'section' && node.openingElement.attributes.properties.some(attribute => attribute.name?.getText(file) === 'className' && attribute.initializer?.text === 'source-deck')) consoleDeck = node;
  ts.forEachChild(node, visit);
})(file);
assert.ok(consoleDeck, 'staff controls use the natural-height source deck instead of video-frame geometry');
const deckCode = ts.transpileModule('(' + consoleDeck.getText(file) + ')', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const consoleLayout = vm.runInNewContext(deckCode, {...context, conferenceItems:result});
assert.equal(consoleLayout.type,'section');
assert.equal(consoleLayout.props.className,'source-deck');
assert.deepEqual(Array.from(consoleLayout.props.children,item=>item),Array.from(result,item=>item.node),'each rich staff card remains a direct deck child with its existing callbacks and key');
assert.doesNotMatch(source, /getUserMedia|publishTrack|action:\s*"(?:claim|heartbeat|release)"/, 'staff scene remains receive-only');
console.log('PASS natural-height staff deck retains exact camera/screen cards, roster selection and receive-only room');


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
  studioRole:'primary', room:{remoteParticipants:new Map([['staff',{sid:'PA-staff'}]])},
});
const renderCode = ts.transpileModule('(' + renderItems.getText(primaryFile) + ')', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const kicks=[];
const studioContext={...context,kick:(...args)=>kicks.push(args)};
const renderLayout = vm.runInNewContext(renderCode, studioContext);
const controller = {type:'persistent-controller'};
const scene = renderLayout([{guest:{identity:'guest-one'},node:controller}]);
assert.equal(scene.type,'section','studio cards use natural content height, not scene video-frame bounds');
assert.equal(scene.props.className,'studio-video-wall studio-production-wall source-deck','the existing compact card grid and device overflow selectors stay applicable');
const cards = Array.from(scene.props.children).flat();
assert.equal(cards[0],controller,'the camera retains its existing controller node');
assert.equal(cards[1].type,'ParticipantSourceCard','auxiliary camera remains its existing rich card');
assert.equal(cards[1].props.sourceKey,'camera:staff');
assert.deepEqual(cards.slice(2).map(card=>card.identity),['guest-one','studio-panel-main'],'screens remain separate cards and primary Return camera is not duplicated');
assert.equal(cards.length,4,'each camera and screen is rendered exactly once');
console.log('PASS natural-height studio deck retains controller nodes and distinct camera/screen cards');

assert.equal(cards[1].props.actions.type,'button','primary studio exposes the staff disconnect action on its source card');
cards[1].props.actions.props.onClick();
assert.deepEqual(kicks,[['staff','Staff','PA-staff']],'staff disconnect targets the current participant session');
studioContext.studioRole='moderator';
let staffCard=Array.from(renderLayout([]).props.children).flat()[0];
assert.equal(staffCard.props.actions,undefined,'secondary studio view does not gain the primary studio staff action');
studioContext.studioRole='primary';studioContext.auxiliaryCameras=[{key:'camera:self',identity:'self',name:'Self',self:true}];
staffCard=Array.from(renderLayout([]).props.children).flat()[0];
assert.equal(staffCard.props.actions,undefined,'the local studio camera never offers self-disconnect');
console.log('PASS actual primary studio staff action is visible, session scoped, and absent for self/secondary studio');
