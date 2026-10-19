const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const file=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let node;(function visit(item){if(ts.isVariableDeclaration(item)&&item.name.getText(file)==='stopOwnedPresentation')node=item.initializer;ts.forEachChild(item,visit);})(file);
assert.ok(node,'the approved toolbar needs a captured-session media-first STOP');
const deferred=()=>{let resolve,reject;return{promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};};
function fixture(kind='pdf'){
 const session={id:'deck',generation:'gen',controlRevision:4,kind,owner:{identity:'owner',sid:'sid'}},media=deferred(),events=[],marker={};let sharing=true;
 const track={mediaStreamTrack:{readyState:'live'},stop(){this.mediaStreamTrack.readyState='ended';}},audio={mediaStreamTrack:{readyState:'live'},stop(){this.mediaStreamTrack.readyState='ended';}},capture={isSharing:()=>sharing,stop:async()=>{events.push('canvas-stop');await media.promise;sharing=false;}},nativeControl={stop(){events.push('native-disconnect');}};
 const context={mounted:{current:true},generation:{current:1},epoch:{current:0},ownRef:{current:session},stopping:{current:undefined},capture:{current:capture},native:{id:'native-binding'},nativeControl:{current:nativeControl},room:{localParticipant:{identity:'owner',sid:'sid',getTrackPublication:source=>source==='screen_audio'?{track:audio}:{track},unpublishTrack:async exact=>{events.push(['unpublish',exact]);if(exact===track)events.push('screen-stop');await media.promise;}}},Track:{Source:{ScreenShare:'screen_share',ScreenShareAudio:'screen_audio'}},controls:{current:{clear(){events.push('clear');}}},flight:{current:true},setStopBusy(){},setBusy(){},setError:message=>events.push(['error',message]),setSessions(){},stopNative(){nativeControl.stop();},updateOwn(value){context.ownRef.current=value;events.push('own-clear');},binding:value=>({id:value.id,generation:value.generation,controlRevision:value.controlRevision}),request:async body=>{events.push(body);return{session:null};},text:{failed:'Stop failed'}};
 const stop=vm.runInNewContext(ts.transpileModule(`(${node.getText(file)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return{context,session,stop,media,events,track,audio,capture,marker};
}
(async()=>{
 for(const kind of ['pdf','powerpoint']){
  const f=fixture(kind),pending=f.stop(f.session);assert.ok(f.events.includes(kind==='pdf'?'canvas-stop':'screen-stop'));
  assert.equal(f.events.some(event=>event?.action==='revoke'),false,'never revoke before media stop confirms');await f.stop(f.session);assert.equal(f.events.filter(event=>event===`${kind==='pdf'?'canvas':'screen'}-stop`).length,1,'single flight despite pending navigation');
  f.media.resolve();await pending;const closed=f.events.find(event=>event?.action==='revoke');assert.equal(closed.close,true);assert.equal(closed.id,'deck');assert.equal(f.context.ownRef.current,undefined);assert.equal(f.context.flight.current,false,'late pending navigation cannot restore closed owner state');
 }
 const replaced=fixture('powerpoint'),pendingReplacement=replaced.stop(replaced.session),newScreen={mediaStreamTrack:{readyState:'live'}},newAudio={mediaStreamTrack:{readyState:'live'}};
 replaced.context.room.localParticipant.getTrackPublication=source=>({track:source==='screen_audio'?newAudio:newScreen});replaced.media.resolve();await pendingReplacement;
 assert.deepEqual(replaced.events.filter(event=>Array.isArray(event)&&event[0]==='unpublish').map(event=>event[1]),[replaced.track,replaced.audio],'STOP unpublishes captured video/audio references only, never async source lookup replacements');assert.equal(newScreen.mediaStreamTrack.readyState,'live');assert.equal(newAudio.mediaStreamTrack.readyState,'live');
 const failed=fixture();const pending=failed.stop(failed.session);failed.media.reject(Error('native failed'));await assert.rejects(pending);assert.equal(failed.context.ownRef.current,failed.session);assert.equal(failed.events.some(event=>event?.action==='revoke'),false,'failed media STOP leaves grant visible/retryable');
 const stale=fixture(),old=stale.stop(stale.session);stale.context.generation.current++;stale.context.ownRef.current={...stale.session,id:'replacement'};stale.media.resolve();await old;assert.equal(stale.context.ownRef.current.id,'replacement');assert.equal(stale.events.some(event=>event?.action==='revoke'),false,'late stop cannot close replacement presentation');
 const foreign=fixture();foreign.context.room.localParticipant.sid='other';await foreign.stop(foreign.session);assert.equal(foreign.events.length,0,'foreign/rejoined SID cannot stop owner media');
 console.log('PASS actual owner STOP: media first, PDF/screen only, independent pending navigation, failure retry, captured generation/SID and replacement isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
