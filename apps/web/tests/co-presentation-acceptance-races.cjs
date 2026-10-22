const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{load}=require('./load-typescript.cjs');
const src=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let accept,effect;
(function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(src)==='acceptRecipient')accept=n.initializer;if(ts.isCallExpression(n)&&n.expression.getText(src)==='useEffect'&&n.arguments[0]?.getText(src).includes('navigation?.preferencesReady'))effect=n.arguments[0];ts.forEachChild(n,visit);})(src);
assert.ok(accept);assert.ok(effect);
const {presentationRecipientAccepted,presentationRecipientAcceptanceKey}=load('../lib/co-presentation-acceptance.ts'),{slideControlsId}=load('../lib/co-presentation-controls.ts');
const compile=(n,c)=>vm.runInNewContext(ts.transpileModule('('+n.getText(src)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
function fixture(){
 const session={id:'s',generation:'g',controlRevision:1,controller:{identity:'guest',sid:'sid'},controllerAccepted:false};
 const c={session,connected:true,controlError:false,room:{localParticipant:{identity:'guest',sid:'sid'}},recipientScope:{current:{}},mounted:{current:true},declinedRecipients:{current:new Set()},acceptedRecipients:{current:new Set()},autoAcceptAttempted:{current:new Set()},acceptanceFlights:{current:new Set()},recipientScreenReady:()=>true,recipientBaseKey:()=>slideControlsId(session),recipientAcceptanceKey:s=>presentationRecipientAcceptanceKey(s,c.room.localParticipant.identity,c.room.localParticipant.sid,'screen'),binding:s=>({id:s.id,generation:s.generation,controlRevision:s.controlRevision}),setAcceptanceRevision(){},setSessions:fn=>c.sessions=fn(c.sessions),sessions:[session],setError(){},text:{failed:'failed'},presentationRecipientAccepted,slideControlsId};
 let calls=0,resolve;c.request=()=>{calls++;return new Promise(r=>resolve=r)};
 return{c,run:compile(accept,c),get calls(){return calls},resolve:v=>resolve(v)};
}
(async()=>{
 let t=fixture();let pending=t.run(t.c.session,true);await t.run(t.c.session,true);assert.equal(t.calls,1,'default auto acceptance request once while pending');t.resolve({session:{...t.c.session,controllerAccepted:true}});await pending;assert.equal(t.c.acceptedRecipients.current.size,1);
 t=fixture();pending=t.run(t.c.session,true);t.c.declinedRecipients.current.add(t.c.recipientBaseKey(t.c.session));t.resolve({session:{...t.c.session,controllerAccepted:true}});await pending;assert.equal(t.c.acceptedRecipients.current.size,0,'decline invalidates late automatic accept response');
 t=fixture();pending=t.run(t.c.session,true);t.c.room.localParticipant.sid='new-sid';t.resolve({session:{...t.c.session,controllerAccepted:true}});await pending;assert.equal(t.c.acceptedRecipients.current.size,0,'new SID cannot inherit late accept');
 t=fixture();pending=t.run(t.c.session,true);t.resolve(Promise.reject(Error('lost reply')));await pending;await t.run(t.c.session,true);assert.equal(t.calls,1,'uncertain automatic accept is not replayed');
 t=fixture();let autoCalls=0;Object.assign(t.c,{sameRecipientScope:true,recipientSessions:[t.c.session],navigation:{preferencesReady:false,autoAccept:true},casters:[],acceptRecipient:()=>autoCalls++});const auto=compile(effect,t.c);auto();assert.equal(autoCalls,0,'stored OFF preference cannot be bypassed before settings hydrate');t.c.navigation.preferencesReady=true;t.c.navigation.autoAccept=false;auto();assert.equal(autoCalls,0);t.c.navigation.autoAccept=true;auto();assert.equal(autoCalls,1,'default ON auto posts acceptance only current bound grant');
 console.log('PASS actual acceptance callback/effect: one exact automatic RPC, preference hydration/OFF, explicit accept result, decline/newSID stale response and no ambiguous replay');
})().catch(e=>{console.error(e);process.exitCode=1;});
