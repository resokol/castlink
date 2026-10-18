const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function source(name){return ts.createSourceFile(name,fs.readFileSync(`${__dirname}/../components/${name}`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function jsx(file,tag){const found=[];(function visit(n){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(file)===tag)found.push(n);ts.forEachChild(n,visit);})(file);return found;}
const context={React:{createElement:(type,props)=>({type,props})},AdminInviteButton:'admin-invite',ModeratorInviteButton:'moderator-invite',TalkbackControls:'talkback',StudioGuestRoleControls:'role-controls',participant:{identity:'guest-one',sid:'PA-current'},roomName:'room',studioId:'studio',room:{},token:'verified-staff-token',clientId:'panel',connected:true,limited:false,activeTab:'participants'};
const evaluate=(text,context)=>vm.runInNewContext(ts.transpileModule(`(${text})`,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText,context);
const management=source('RoomManagementPanel.tsx'),workspace=source('StudioWorkspace.tsx'),consoleFile=source('RoomControlConsole.tsx');
for(const file of [management,workspace,consoleFile])assert.equal(jsx(file,'ServerStaffAccessPanel').length,0,'removed global access panel is not mounted');
for(const tag of ['AdminInviteButton','ModeratorInviteButton']){const node=jsx(management,tag)[0];assert.ok(node,`studio room menu restores ${tag}`);const props=evaluate(node.getText(management),context).props;assert.equal(props.roomName,'room');assert.equal(props.studioId,'studio');if(tag==='ModeratorInviteButton')assert.equal(props.scope,'room','studio moderator invitation stays within selected room');}
assert.equal(jsx(consoleFile,'AdminInviteButton').length,0,'delegated admin cannot issue administrator links');
const moderator=jsx(consoleFile,'ModeratorInviteButton')[0];assert.ok(moderator,'legacy administrator moderator invitation is restored');const moderatorProps=evaluate(moderator.getText(consoleFile),context).props;assert.equal(moderatorProps.roomName,'room');assert.equal(moderatorProps.studioId,'studio');assert.equal(moderatorProps.scope,'room');assert.equal(evaluate(moderator.parent.getText(consoleFile),{...context,limited:true}),false,'limited moderator cannot issue invitations');
let talk;(function visit(node){if(ts.isJsxOpeningElement(node)&&node.tagName.getText(consoleFile)==='TalkbackControls')talk=node;ts.forEachChild(node,visit);})(consoleFile);
const bearer=talk.attributes.properties.find(property=>property.name?.getText(consoleFile)==='token');assert.equal(evaluate(bearer.initializer.expression.getText(consoleFile),context),context.token,'private-talk API gets verified staff bearer');
assert.ok(talk.attributes.properties.some(property=>property.name?.getText(consoleFile)==='compact'),'admin/mod share the compact toolbar');
const role=jsx(consoleFile,'StudioGuestRoleControls')[0];assert.ok(role);const roleProps=evaluate(role.getText(consoleFile),context).props;assert.equal(roleProps.participantSid,'PA-current');assert.equal(roleProps.identity,'guest-one');
let airButton;(function visit(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(consoleFile)==='button'&&n.openingElement.attributes.properties.some(p=>p.name?.getText(consoleFile)==='className'&&p.getText(consoleFile).includes('air-toggle')))airButton=n;ts.forEachChild(n,visit);})(consoleFile);
assert.ok(airButton,'staff console exposes broadcast control');
for(const onAir of [false,true]){
 const sent=[];const state={...context,snapshot:{desired:{onAir},actual:{onAir}},busy:false,controlReady:true,t:x=>x,command:patch=>sent.push(patch),React:{createElement:(type,props,...children)=>({type,props:{...props,children}})}};
 const rendered=evaluate(airButton.getText(consoleFile),state);
 assert.equal(rendered.props.children.join(''),onAir?'ON AIR':'OFF AIR','broadcast label shows confirmed state, not the opposite action');
 assert.equal(rendered.props['aria-pressed'],onAir,'state drives the same CSS selector as the studio');
 assert.equal(rendered.props['aria-label'],onAir?'Завершить эфир':'Начать эфир');
 rendered.props.onClick();assert.equal(sent[0].onAir,!onAir,'click requests the opposite state');
 assert.equal(evaluate(airButton.getText(consoleFile),{...state,busy:true}).props.disabled,true,'pending command cannot be repeated');
 assert.equal(evaluate(airButton.getText(consoleFile),{...state,controlReady:false}).props.disabled,true,'offline primary is not controllable');
 assert.equal(evaluate(airButton.getText(consoleFile),{...state,snapshot:{desired:{onAir},actual:{onAir,airBusy:true}}}).props.disabled,true,'media transition cannot be repeated');
}
const failed=evaluate(airButton.getText(consoleFile),{...context,snapshot:{desired:{onAir:true},actual:{onAir:false,error:'camera failed'}},busy:false,controlReady:true,t:x=>x,command:()=>{},React:{createElement:(type,props,...children)=>({type,props:{...props,children}})}});assert.equal(failed.props['aria-pressed'],false);assert.equal(failed.props.children.join(''),'OFF AIR');assert.equal(failed.props.disabled,false,'failed publication can be retried');
console.log('PASS room/staff JSX: legacy scope, verified bearer and confirmed ON AIR state with accessible action');
