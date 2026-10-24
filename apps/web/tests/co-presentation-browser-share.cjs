'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{EventEmitter}=require('node:events');
const file=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),vars={};
let effect,showMenu,ownerClick;
(function visit(n){
 if(ts.isVariableDeclaration(n))vars[n.name.getText(file)]=n.initializer;
 if(ts.isCallExpression(n)&&n.expression.getText(file)==='useEffect'&&n.arguments[0]?.getText(file).includes('const ownedCapture = createCanvasPresentationCapture'))effect=n.arguments[0];
 if(ts.isBinaryExpression(n)&&n.left.getText(file)==='showOwnerMenu.current')showMenu=n.right;
 if(ts.isJsxOpeningElement(n)&&n.tagName.getText(file)==='button'&&n.attributes.getText(file).includes('co-presentation-owner-trigger'))ownerClick=n.attributes.properties.find(a=>a.name?.text==='onClick')?.initializer?.expression;
 ts.forEachChild(n,visit);
})(file);
const evaluate=(node,scope)=>vm.runInNewContext(ts.transpileModule('('+node.getText(file)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
const room=new EventEmitter(),track={mediaStreamTrack:{readyState:'live'},stop(){assert.fail('menu cannot stop capture');}};
let publication={trackSid:'screen-A',track,isMuted:false},launches=0;
room.state='connected';room.remoteParticipants=new Map();room.localParticipant={sid:'owner-A',identity:'guest-owner',getTrackPublication:()=>publication};
const c={browserHelper:{current:undefined},setBrowserPair(){},menu:{current:undefined},screenMenuShare:{current:undefined},preparedChoice:{current:undefined},room,Track:{Source:{ScreenShare:'screen'}},RoomEvent:new Proxy({},{get:(_,k)=>k}),generation:{current:4},fileGeneration:{current:9},epoch:{current:2},fileRef:{current:undefined},canvas:{current:{}},ownedScreen:{current:undefined},ownRef:{current:undefined},pendingNativeShare:{current:undefined},windowIntent:{current:undefined},pendingHelper:{current:undefined},requestedKind:{current:undefined},flight:{current:false},stopping:{current:undefined},setWindowController(){},setConnected(){},setScreenSharing(){},setCasters(){},setHelperPair(){},setBusy(){},nativeAutoAttach:{current:()=>launches++}};
for(const name of ['captureNativeShare','nativeShareCurrent','cancelWindowIntent','update','events'])c[name]=evaluate(vars[name],c);
if(vars.attachPublished)c.attachPublished=evaluate(vars.attachPublished,c);
for(const stmt of effect.body.statements){
 const text=stmt.getText(file);
 if(text.startsWith('events.forEach(')||text.startsWith('room.on(RoomEvent.LocalTrackPublished,'))vm.runInNewContext(text,c);
}
room.emit(c.RoomEvent.LocalTrackPublished);room.emit(c.RoomEvent.LocalTrackPublished);
assert.equal(launches,0,'ordinary browser publication must not pair or launch any local presentation component');
assert.ok(ownerClick,'owner retains a separate explicit presentation controls button');
let opened=0;const document={},button={isConnected:true,ownerDocument:document};
Object.assign(c,{mounted:{current:true},own:undefined,ownedScreen:{current:undefined},menu:{current:{ownerDocument:document,showPopover(){opened++;}}},menuInitiator:{current:undefined},setSelectedControls(){},isOwner:s=>s.owner.sid===room.localParticipant.sid});
c.showOwnerMenu={current:evaluate(showMenu,c)};const click=evaluate(ownerClick,c);click({currentTarget:button});
assert.equal(opened,1);assert.equal(c.menuInitiator.current,button);assert.equal(c.screenMenuShare.current.track,track);assert.equal(launches,0);
for(const state of ['absent','muted','ended','disconnected']){
 publication=state==='absent'?undefined:{trackSid:'screen-A',track:{mediaStreamTrack:{readyState:state==='ended'?'ended':'live'}},isMuted:state==='muted'};
 room.state=state==='disconnected'?'disconnected':'connected';click({currentTarget:button});assert.equal(opened,1,'menu revalidates '+state+' capture');
}
room.state='connected';publication={trackSid:'screen-B',track:{mediaStreamTrack:{readyState:'live'}}};
c.own={id:'deck',generation:'g',owner:{sid:'owner-A'}};c.ownedScreen.current={id:'deck',generation:'g',track,trackSid:'screen-A'};
click({currentTarget:button});assert.equal(opened,1,'old presentation binding cannot open controls for a replaced screen');
console.log('PASS ordinary browser publication never launches helper; separate owner click only opens current guarded controls');
