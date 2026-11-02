'use strict';
// Runs the production broker against only the standalone fixture's new Preview.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const MAX_OUTPUT=512*1024;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function rpc(executable,args=[],broker=false){
  const child=spawn(executable,args,{shell:false,stdio:['pipe','pipe','pipe']});
  let buffer='',bytes=0,sequence=0,closed=false,error=null;const events=[],pending=new Map();
  function fail(reason){error=reason;for(const p of pending.values()){clearTimeout(p.timer);p.reject(reason);}pending.clear();}
  child.stdout.on('data',chunk=>{
    bytes+=chunk.length;if(bytes>MAX_OUTPUT){fail(Error('Fixture output exceeded bound'));child.stdin.end();return;}
    buffer+=chunk.toString('utf8');
    while(buffer.includes('\n')){
      const index=buffer.indexOf('\n'),line=buffer.slice(0,index);buffer=buffer.slice(index+1);
      let value;try{value=JSON.parse(line);}catch{fail(Error('Fixture returned invalid JSON'));child.stdin.end();return;}
      const id=broker?value.requestId:value.id;
      if(pending.has(id)){const p=pending.get(id);pending.delete(id);clearTimeout(p.timer);p.resolve(broker?value.value:value);}
      else if(events.length<16)events.push(value);
    }
  });
  child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_OUTPUT){fail(Error('Fixture output exceeded bound'));child.stdin.end();}});
  child.on('error',()=>fail(Error('Fixture process could not start')));
  child.on('close',()=>{closed=true;fail(Error('Fixture process exited'));});
  child.stdin.on('error',()=>fail(Error('Fixture input closed')));
  return {child,async event(){for(let attempt=0;attempt<400;attempt++){if(events.length)return events.shift();if(error)throw error;await delay(25);}throw Error('Fixture launch timed out');},
    request(op,fields={}){
      if(error)return Promise.reject(error);const id=++sequence;
      return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Native Preview command timed out'));},7000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify(broker?{requestId:id,args:op}:{id,op,...fields})+'\n');});
    },async stop(){
      child.stdin.end();for(let attempt=0;attempt<60&&!closed;attempt++)await delay(50);
      // Only the directly spawned CLI is signalled. Preview cleans up its own
      // independently verified PID on EOF and on its internal deadline.
      if(!closed)child.kill('SIGTERM');
    }};
}
function editableRefusalVerified(error,{unchanged,oldStatus,freshBinding,originalBinding,ownedWindowVerified}={}){
  if(unchanged!==true)return false;
  if(error==='WINDOW_SLIDES_FOREGROUND')return true;
  return error==='WINDOW_SLIDES_STALE'&&oldStatus==='WINDOW_SLIDES_STALE'&&
    typeof freshBinding==='string'&&/^[a-f0-9]{64}$/.test(freshBinding)&&
    typeof originalBinding==='string'&&/^[a-f0-9]{64}$/.test(originalBinding)&&freshBinding!==originalBinding&&ownedWindowVerified===true;
}
async function runPreviewFixture({helper,fixture,artifact}){
  const evidence={schemaVersion:1,protocol:1,fixture:'owned-preview-pdf',platform:process.platform,arch:process.arch,status:'NOT VERIFIED',osOperationVerified:false,checks:[]};
  let owner,broker,ownerReady=false;
  async function snap(retryMs=0){
    const until=Date.now()+retryMs;
    do{
      const result=await owner.request('snapshot');if(result.ok)return result;
      evidence.snapshotFailures??=[];evidence.snapshotFailures.push(result);if(evidence.snapshotFailures.length>8)evidence.snapshotFailures.shift();
      if(Date.now()>=until){evidence.ownedAXDiagnostics=await owner.request('diagnostics');throw Error('Owned Preview AX snapshot unavailable: '+(result.error||'unknown'));}
      await delay(150);
    }while(true);
  }
  async function changed(before){for(let attempt=0;attempt<24;attempt++){await delay(80);const current=await snap();if(current.observations.length&&JSON.stringify(current.observations)!==JSON.stringify(before.observations))return current;}throw Error('Preview PDF step produced no observed scroll or page-marker position change');}
  try{
    if(process.platform!=='darwin'){evidence.reason='macOS is required';return evidence;}
    assert.ok(helper&&fixture,'Compiled slides helper and Preview fixture are required');
    owner=rpc(fixture);const ready=await owner.event();
    if(ready.event==='unavailable'){evidence.reason=ready.reason;return evidence;}
    assert.equal(ready.event,'ready',ready.reason||'Preview fixture did not launch');ownerReady=true;
    assert.equal(ready.notPreexisting,true);assert.equal(ready.exactSystemBundle,true);assert.ok(Number.isSafeInteger(ready.kernelBirth)&&ready.kernelBirth>0);assert.equal(ready.generatedPDFPages,3);
    evidence.identity={notPreexisting:true,exactSystemBundle:true,kernelBirthVerified:true,generatedPDFPages:ready.generatedPDFPages};
    broker=rpc(helper,['--server'],true);let target;
    for(let attempt=0;attempt<32;attempt++){
      const rows=await broker.request(['list']);
      if(rows?.error==='WINDOW_SLIDES_ACCESSIBILITY_PERMISSION'){evidence.reason='Production slides helper Accessibility permission is unavailable';return evidence;}
      assert.ok(Array.isArray(rows),'Slides broker list failed');
      const matches=rows.filter(row=>row.name===ready.documentName);assert.ok(matches.length<=1,'Owned Preview document binding is ambiguous');
      if(matches.length===1){target=matches[0];break;}await delay(150);
    }
    assert.ok(target,'Production slides broker could not bind the actual owned Preview PDF');
    assert.equal((await owner.request('verifyWindow',{windowHandle:target.windowHandle})).ok,true,'Broker window is not the independently verified Preview window');
    const identity=[target.windowHandle,target.binding];
    assert.match(target.binding,/^[a-f0-9]{64}$/);assert.equal((await broker.request(['status',...identity])).binding,target.binding);
    evidence.checks.push('production list and status bind the exact owned Preview PDF window');
    assert.equal((await broker.request(['activate',...identity])).binding,target.binding);
    // LaunchServices/window binding can become ready before PDFKit's AX tree.
    // Require the same owned document's real snapshot within a bounded wait.
    const startup=await snap(8000);evidence.startupSnapshot={nodeCount:startup.nodeCount,roles:startup.roles,focus:startup.focus,pdfContentFocused:startup.pdfContentFocused};
    let focused=false;evidence.focusAttempts=[];
    for(let attempt=0;attempt<8;attempt++){
      const result=await owner.request('focus');
      const trace={attempt,action:result};evidence.focusAttempts.push(trace);
      await delay(150);const state=await snap(2000);trace.observed=state.focus;
      if(result.ok&&state.frontmostMatches&&state.pdfContentFocused===true){focused=true;break;}
    }
    if(!focused)evidence.ownedAXDiagnostics=await owner.request('diagnostics');
    assert.equal(focused,true,'Preview PDF content focus could not be established');
    const before=await snap();assert.ok(before.observations.length,'Preview exposes no real scroll or page-marker observation');
    evidence.observation={kind:'AX scrollbar value or generated page-marker position',nodeCount:before.nodeCount,roles:before.roles};
    for(const direction of ['next','previous']){
      const initial=await snap();const result=await broker.request(['step',...identity,direction,String(Date.now()+3000)]);
      assert.equal(result.binding,target.binding,'Production Preview '+direction+' refused: '+(result.error||'unexpected identity'));
      await changed(initial);evidence.checks.push('production '+direction+' changes observed PDF position');
    }
    evidence.preEditableProof=await owner.request('captureProof');assert.equal(evidence.preEditableProof.ok,true,'Could not retain owned Preview PDF proof before search');
    assert.equal((await owner.request('editable')).ok,true,'Owned Preview search could not be opened');
    let edit;
    for(let attempt=0;attempt<20;attempt++){await delay(75);edit=await snap();if(['AXTextField','AXTextArea','AXComboBox','AXSearchField'].includes(edit.focusRole))break;}
    assert.ok(['AXTextField','AXTextArea','AXComboBox','AXSearchField'].includes(edit.focusRole),'Preview search did not expose actual editable focus');
    // Let the native search layout settle before measuring an attempted step.
    for(let attempt=0;attempt<8;attempt++){
      await delay(100);const settled=await snap();
      if(JSON.stringify(settled.observations)===JSON.stringify(edit.observations)){edit=settled;break;}
      edit=settled;
    }
    assert.ok(['AXTextField','AXTextArea','AXComboBox','AXSearchField'].includes(edit.focusRole),'Owned Preview editable focus changed before refusal test');
    const refusal=await broker.request(['step',...identity,'next',String(Date.now()+3000)]);
    evidence.editableRefusal={error:refusal.error||null,nativeProof:await owner.request('proofIdentity')};
    await delay(150);const afterRefusal=await snap();
    const unchanged=JSON.stringify(afterRefusal.observations)===JSON.stringify(edit.observations);
    evidence.editableRefusal.positionUnchanged=unchanged;
    async function freshOwnedTarget(){
      for(let attempt=0;attempt<24;attempt++){
        const rows=await broker.request(['list']);assert.ok(Array.isArray(rows),'Preview rebind list failed');
        const matches=rows.filter(row=>row.name===ready.documentName);assert.ok(matches.length<=1,'Owned Preview rebind is ambiguous');
        if(matches.length===1){
          const fresh=matches[0];assert.match(fresh.binding,/^[a-f0-9]{64}$/);
          assert.equal((await owner.request('verifyWindow',{windowHandle:fresh.windowHandle})).ok,true,'Rebound PDF is not the exact owned Preview window');
          assert.equal((await broker.request(['status',fresh.windowHandle,fresh.binding])).binding,fresh.binding,'Fresh owned Preview binding is not live');
          return fresh;
        }
        await delay(100);
      }
      throw Error('Could not explicitly rebind the owned Preview PDF');
    }
    let staleStatus;
    if(refusal.error==='WINDOW_SLIDES_STALE'){
      staleStatus=(await broker.request(['status',...identity])).error;
      evidence.editableRefusal.oldStatus=staleStatus||null;
      assert.equal(staleStatus,'WINDOW_SLIDES_STALE','Rejected Preview binding did not remain invalidated');
      assert.equal(unchanged,true,'Rejected stale editable step changed PDF position');
    }else assert.equal(editableRefusalVerified(refusal.error,{unchanged}),true,'Editable Preview step was not rejected with unchanged PDF position');
    assert.equal((await owner.request('cancelEditable')).ok,true,'Owned Preview editable search could not be cancelled');
    let cancelled=false;
    for(let attempt=0;attempt<20;attempt++){
      await delay(75);const state=await snap(1000);
      if(!['AXTextField','AXTextArea','AXComboBox','AXSearchField'].includes(state.focusRole)){cancelled=true;break;}
    }
    assert.equal(cancelled,true,'Owned Preview search retained editable focus after cancellation');
    const closingTarget=await freshOwnedTarget(),closingIdentity=[closingTarget.windowHandle,closingTarget.binding];
    evidence.closeSourceRebound=true;
    if(staleStatus){
      Object.assign(evidence.editableRefusal,{freshBindingReplaced:closingTarget.binding!==target.binding,ownedWindowVerified:true});
      assert.equal(editableRefusalVerified(refusal.error,{unchanged,oldStatus:staleStatus,freshBinding:closingTarget.binding,originalBinding:target.binding,ownedWindowVerified:true}),true,'Editable Preview step did not prove a rejected, invalidated binding with unchanged PDF position');
      assert.notEqual(closingTarget.binding,target.binding,'Invalidated Preview binding revived after search cancellation');
      assert.equal((await broker.request(['status',...identity])).error,'WINDOW_SLIDES_STALE');
      assert.equal((await broker.request(['step',...identity,'next',String(Date.now()+3000)])).error,'WINDOW_SLIDES_STALE');
      evidence.checks.push('search invalidation requires a fresh owned binding and never revives the old binding');
    }
    evidence.checks.push('actual Preview editable search rejects step without changing PDF position');
    assert.equal((await owner.request('close')).ok,true,'Owned Preview document close failed');
    let closed=false;
    for(let attempt=0;attempt<20;attempt++){await delay(75);if((await owner.request('closed')).closed){closed=true;break;}}
    assert.equal(closed,true,'Owned Preview document remains open');
    assert.equal((await broker.request(['status',...closingIdentity])).error,'WINDOW_SLIDES_STALE');
    assert.equal((await broker.request(['step',...closingIdentity,'next',String(Date.now()+3000)])).error,'WINDOW_SLIDES_STALE');
    if(staleStatus){
      assert.equal((await broker.request(['status',...identity])).error,'WINDOW_SLIDES_STALE');
      assert.equal((await broker.request(['step',...identity,'next',String(Date.now()+3000)])).error,'WINDOW_SLIDES_STALE');
    }
    evidence.checks.push('closed source rejects freshly retained status and step as stale');
    evidence.status='VERIFIED';evidence.osOperationVerified=true;
  }catch(error){evidence.status='FAILED';evidence.reason=error.message;}
  finally{
    await broker?.stop();
    if(ownerReady){
      try{const cleanup=await owner.request('quit');assert.equal(cleanup.ownedProcessTerminated,true,'Owned Preview cleanup did not terminate its verified process');evidence.cleanupVerified=true;}
      catch(error){evidence.status='FAILED';evidence.osOperationVerified=false;evidence.cleanupVerified=false;evidence.reason='Preview fixture cleanup failed: '+error.message;}
    }
    await owner?.stop();
    if(artifact){fs.mkdirSync(path.dirname(artifact),{recursive:true});fs.writeFileSync(artifact,JSON.stringify(evidence,null,2)+'\n');}
  }
  return evidence;
}
module.exports={runPreviewFixture,editableRefusalVerified};
if(require.main===module){const [helper,fixture,artifact]=process.argv.slice(2);runPreviewFixture({helper,fixture,artifact}).then(value=>{console.log(JSON.stringify(value));if(value.status==='FAILED')process.exitCode=1;}).catch(()=>{console.error('Preview fixture driver failed');process.exitCode=1;});}
