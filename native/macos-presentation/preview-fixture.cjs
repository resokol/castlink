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
async function runPreviewFixture({helper,fixture,artifact}){
  const evidence={schemaVersion:1,protocol:1,fixture:'owned-preview-pdf',platform:process.platform,arch:process.arch,status:'NOT VERIFIED',osOperationVerified:false,checks:[]};
  let owner,broker,ownerReady=false;
  async function snap(){const result=await owner.request('snapshot');assert.equal(result.ok,true,'Owned Preview AX snapshot unavailable');return result;}
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
    let focused=false;
    for(let attempt=0;attempt<20;attempt++){
      const result=await owner.request('focus');await delay(100);const state=await snap();
      if(result.ok&&state.frontmostMatches&&['AXScrollArea','AXLayoutArea'].includes(state.focusRole)){focused=true;break;}
    }
    assert.equal(focused,true,'Preview PDF content focus could not be established');
    const before=await snap();assert.ok(before.observations.length,'Preview exposes no real scroll or page-marker observation');
    evidence.observation={kind:'AX scrollbar value or generated page-marker position',nodeCount:before.nodeCount,roles:before.roles};
    for(const direction of ['next','previous']){
      const initial=await snap();const result=await broker.request(['step',...identity,direction,String(Date.now()+3000)]);
      assert.equal(result.binding,target.binding,'Production Preview '+direction+' refused: '+(result.error||'unexpected identity'));
      await changed(initial);evidence.checks.push('production '+direction+' changes observed PDF position');
    }
    assert.equal((await owner.request('editable')).ok,true,'Owned Preview search could not be opened');
    let edit;
    for(let attempt=0;attempt<20;attempt++){await delay(75);edit=await snap();if(['AXTextField','AXTextArea','AXComboBox','AXSearchField'].includes(edit.focusRole))break;}
    assert.ok(['AXTextField','AXTextArea','AXComboBox','AXSearchField'].includes(edit.focusRole),'Preview search did not expose actual editable focus');
    const refusal=await broker.request(['step',...identity,'next',String(Date.now()+3000)]);
    assert.equal(refusal.error,'WINDOW_SLIDES_FOREGROUND','Production helper accepted editable Preview focus');
    await delay(150);assert.deepEqual((await snap()).observations,edit.observations,'Rejected editable-focus step changed PDF position');
    evidence.checks.push('actual Preview editable search focus refuses step without changing PDF position');
    assert.equal((await owner.request('close')).ok,true,'Owned Preview document close failed');
    let closed=false;
    for(let attempt=0;attempt<20;attempt++){await delay(75);if((await owner.request('closed')).closed){closed=true;break;}}
    assert.equal(closed,true,'Owned Preview document remains open');
    assert.equal((await broker.request(['status',...identity])).error,'WINDOW_SLIDES_STALE');
    assert.equal((await broker.request(['step',...identity,'next',String(Date.now()+3000)])).error,'WINDOW_SLIDES_STALE');
    evidence.checks.push('closed source rejects retained status and step as stale');
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
module.exports={runPreviewFixture};
if(require.main===module){const [helper,fixture,artifact]=process.argv.slice(2);runPreviewFixture({helper,fixture,artifact}).then(value=>{console.log(JSON.stringify(value));if(value.status==='FAILED')process.exitCode=1;}).catch(()=>{console.error('Preview fixture driver failed');process.exitCode=1;});}
