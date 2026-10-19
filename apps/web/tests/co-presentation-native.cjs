const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleUnderTest={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/co-presentation-native.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleUnderTest,exports:moduleUnderTest.exports,require:()=>({}),Error,Number});
const {createNativePresentationControl,powerPointBridge,validNativePresentation}=moduleUnderTest.exports;
const native={id:'deck-scope',name:'Music.pptx',pages:4,page:2};
const session={id:'server-id',generation:'server-generation',kind:'powerpoint',pages:4,page:2,revision:0,renderedRevision:-1};
function fixture(){
 let actual={...native},current=true,failures=0,failingRequest;const calls=[],changes=[];
 const bridge={connect:async()=>native,status:async id=>{calls.push(['status',id]);return actual;},goTo:async command=>{calls.push(['goTo',command]);actual={...actual,page:command.page};return actual;},disconnect:async id=>{calls.push(['disconnect',id]);}};
 const request=async body=>{calls.push(['request',body]);return{session:{...session,...body,renderedRevision:body.revision}}};
 const control=createNativePresentationControl({bridge,native,current:()=>current,request:body=>failingRequest?Promise.reject(failingRequest):request(body),changed:state=>changes.push(state),failed:()=>failures++});
 return{bridge,calls,changes,control,requestError:value=>failingRequest=value,actual:value=>actual=value,stale:()=>current=false,failures:()=>failures};
}
(async()=>{
 assert.equal(powerPointBridge({}),undefined);assert.equal(validNativePresentation({...native,page:5}),false);
 let f=fixture();assert.equal(powerPointBridge({castlinkDesktop:{version:1,powerPoint:f.bridge}}),f.bridge);
 await f.control.tick(session);assert.equal(f.calls.find(call=>call[0]==='request')[1].action,'ack','initial actual slide acknowledgement');assert.ok(!f.calls.some(call=>call[0]==='goTo'),'initial connection does not reset slideshow');
 f=fixture();await f.control.tick({...session,page:3,revision:1});assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call=>call[0]==='goTo')[1])),{id:native.id,page:3});assert.equal(f.calls.find(call=>call[0]==='request')[1].page,3);assert.equal(f.changes.length,1);
 f=fixture();f.actual({...native,page:4});await f.control.tick({...session,renderedRevision:0});assert.equal(f.calls.find(call=>call[0]==='request')[1].action,'sync');assert.equal(f.calls.find(call=>call[0]==='request')[1].page,4,'manual native navigation reported to server');assert.ok(!f.calls.some(call=>call[0]==='goTo'));
 f=fixture();f.actual({...native,id:'another-deck'});await f.control.tick(session);assert.equal(f.failures(),1);assert.ok(!f.calls.some(call=>call[0]==='goTo'||call[0]==='request'),'never controls foreign presentation');
 f=fixture();f.bridge.goTo=async()=>({...native,page:1});await f.control.tick({...session,page:3,revision:1});assert.equal(f.failures(),1);assert.ok(!f.calls.some(call=>call[0]==='request'),'no success ACK without exact slide');
 f=fixture();let resolve;f.bridge.status=()=>new Promise(r=>resolve=r);const late=f.control.tick({...session,page:3,revision:1});f.control.stop();resolve(native);await late;assert.deepEqual(f.calls,[['disconnect',native.id]],'stopped binding never performs late navigation');f.control.stop();assert.equal(f.calls.length,1,'disconnect exact native binding once');
 f=fixture();f.requestError({status:409});await f.control.tick(session);assert.equal(f.failures(),0,'remote/manual navigation conflict waits for fresh state');
 f=fixture();f.requestError({status:401});await f.control.tick(session);assert.equal(f.failures(),1,'lost authorization closes control');
 f=fixture();f.stale();await f.control.tick(session);assert.equal(f.calls.length,0,'scope cancellation blocks native calls');
 console.log('PASS native PowerPoint bridge detection, exact scoped slides, verified ACK, manual-slide sync, foreign-deck rejection, and stale/stop cancellation without app or screen-share operations');
})().catch(error=>{console.error(error);process.exitCode=1;});
