const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let openNode,openedNode,startNode;(function visit(node){if(ts.isPropertyAssignment(node)&&node.name.getText(source)==='browserOpened')openedNode=node.initializer;if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='openControls')openNode=node.initializer;if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='start')startNode=node.initializer;ts.forEachChild(node,visit);})(source);
const {slideControlsId}=require('./load-typescript.cjs').load('../lib/co-presentation-controls.ts');
const expression=context=>vm.runInNewContext(ts.transpileModule('('+openNode.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const first={id:'one',generation:'gen',controlRevision:1},second={...first,id:'two'},events=[],held=[];
 let gesture=false;
 const adapter={native:false,update(state){events.push(['update',state.id]);return Promise.resolve();},show(){assert.equal(gesture,true,'requestWindow path stays inside the explicit click');events.push(['show']);return new Promise(resolve=>held.push(resolve));}};
 const scope={},context={controls:{current:adapter},slideControlsId,controlledSessions:[first,second],connected:true,controlError:false,isOwner:()=>false,presentationSharing:()=>false,activeControls:first,pendingNative:{current:''},setSelectedControls:id=>events.push(['selected',id]),recipientScope:{current:scope},epoch:{current:3},floatingRequest:{current:undefined},currentControlsGrant:{current:slideControlsId(first)},controlsState:s=>({id:slideControlsId(s)}),setFloatingFailed:value=>events.push(['failed',value]),mounted:{current:true},setNativeGrant:value=>events.push(['grant',value]),setRecipientReopen:()=>events.push(['inline']),menu:{current:{showPopover(){events.push(['menu']);}}}};
 const open=expression(context);
 // Execute the real Share presentation handler with capture deliberately held:
 // a request after publication/React effects has already lost this gesture.
 const file={},owner={...first,owner:{identity:'owner',sid:'owner-sid'}},started=[];let publish;
 const startContext={canvas:{current:{}},fileRef:{current:file},generation:{current:1},connected:true,busy:false,mounted:{current:true},ownRef:{current:owner},room:{localParticipant:{identity:'owner',sid:'owner-sid'}},isOwner:s=>s.owner.identity==='owner'&&s.owner.sid==='owner-sid',setError(){},setBusy(){},text:{failed:'failed'},openControls(session){assert.equal(gesture,true,'Share presentation opens controls before any await');started.push(session);},capture:{current:{start(){return new Promise(resolve=>publish=resolve);}}}};
 const start=vm.runInNewContext(ts.transpileModule('('+startNode.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,startContext);
 gesture=true;const sharing=start();gesture=false;assert.equal(started.length,1,'Share presentation automatically requests compact slide controls');assert.equal(started[0],owner);publish();await sharing;
 startContext.ownRef.current={...owner,owner:{identity:'owner',sid:'old-sid'}};gesture=true;const staleStart=start();gesture=false;assert.equal(started.length,1,'stale owner SID cannot open controls');publish();await staleStart;
 const click=session=>{gesture=true;open(session);gesture=false;};
 click(second);assert.equal(events[0][0],'update');assert.equal(events[0][1],slideControlsId(second));assert.equal(events.filter(e=>e[0]==='show').length,1,'different-session click does not defer to React effect');
 click(first);held[0](false);await settle();assert.equal(events.some(e=>e[0]==='failed'&&e[1]===true),false,'old failed request cannot reset a newer explicit request');held[1](true);await settle();
 click(second);context.currentControlsGrant.current='';held[2](false);await settle();assert.equal(events.some(e=>e[0]==='inline'),false,'revoked late result cannot reopen inline UI');
 click({...first,controlRevision:9});assert.equal(held.length,3,'stale exact grant cannot request a window');
 context.currentControlsGrant.current=slideControlsId(second);click(second);held[3](false);await settle();assert.ok(events.some(e=>e[0]==='inline'),'current rejection returns to working inline controls');
 adapter.native=true;context.activeControls=first;gesture=true;open(second);gesture=false;assert.equal(context.pendingNative.current,slideControlsId(second),'native selected-session flow is preserved');assert.equal(held.length,4,'native transition retains its existing effect route');
 let cleared=0,hidden=0;const ownerAdapter={clear(){cleared++;}},room={},openedContext={renderScope:{current:{room,token:'token',studioId:'studio',roomName:'room'}},mounted:{current:true},controls:{current:ownerAdapter},slideControls:ownerAdapter,currentControlsGrant:{current:'current'},room,token:'token',studioId:'studio',roomName:'room',setFloatingFailed(){},setNativeGrant(){},menu:{current:{matches:()=>true,hidePopover(){hidden++;}}}};
 const opened=vm.runInNewContext(ts.transpileModule('('+openedNode.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,openedContext);
 opened('current');assert.equal(hidden,1);opened('old');assert.equal(cleared,1);openedContext.renderScope.current={...openedContext.renderScope.current,token:'new-room-token'};opened('current');assert.equal(cleared,2,'success arriving after scope render before effect is cleared');
 console.log('PASS actual browser click: synchronous alternate grant, stale result/scope/revoke, explicit fallback and native route');
})().catch(e=>{console.error(e);process.exitCode=1;});
