const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-video-mode-'));process.env.STUDIOLINK_STUDIO_CONTROL_FILE=path.join(directory,'control.json');
const control=require('../lib/studio-control.ts');
(async()=>{try{
 const {state}=await control.joinStudio('studio-a','primary-client-a');const epoch=state.epoch;
 assert.equal(state.desired.videoCodec,'av1');assert.equal(state.desired.simulcast,true);assert.equal(state.desired.bitrate,12000);
 assert.ok(await control.updateStudioDesired('studio-a',epoch,{videoCodec:'h264',simulcast:false,bitrate:25000}));
 assert.equal((await control.readStudioState('studio-a')).desired.videoCodec,'h264');
 assert.ok(await control.updateStudioDesired('studio-a',epoch,{videoCodec:'av1'}));
 assert.equal((await control.readStudioState('studio-a')).desired.videoCodec,'av1');
 assert.equal(await control.updateStudioDesired('studio-a',epoch,{videoCodec:'bogus'}),null);
 assert.equal(await control.updateStudioDesired('studio-a',epoch,{simulcast:'false'}),null);
 assert.equal(await control.updateStudioDesired('studio-a',epoch,{bitrate:25001}),null);
 await control.updateStudioDesired('studio-a',epoch,{onAir:true});
 assert.equal(await control.updateStudioDesired('studio-a',epoch,{videoCodec:'vp8'}),null);
 assert.equal(await control.updateStudioDesired('studio-a',epoch,{simulcast:true,onAir:false}),null,'OFFAIR must be acknowledged separately');
 assert.ok(await control.updateStudioDesired('studio-a',epoch,{bitrate:20000}),'bitrate remains live adjustable');
 await control.updateStudioDesired('studio-a',epoch,{onAir:false});
 await control.heartbeatStudio('studio-a','primary-client-a',epoch,{onAir:true,airBusy:false});
 assert.equal(await control.updateStudioDesired('studio-a',epoch,{simulcast:true}),null,'actual ON AIR also protects codec mode');
 await control.heartbeatStudio('studio-a','primary-client-a',epoch,{onAir:false,airBusy:true});
 assert.equal(await control.updateStudioDesired('studio-a',epoch,{videoCodec:'vp8'}),null);
 await control.heartbeatStudio('studio-a','primary-client-a',epoch,{onAir:false,airBusy:false});
 assert.ok(await control.updateStudioDesired('studio-a',epoch,{videoCodec:'vp8',simulcast:true}));
 await control.joinStudio('studio-b','primary-client-b');
 assert.equal((await control.readStudioState('studio-b')).desired.bitrate,12000,'room quality stays isolated');
 assert.equal((await control.readStudioState('studio-b')).desired.videoCodec,'av1');
 for(const reverse of [false,true]) {
  const room='mode-race-'+reverse,joined=await control.joinStudio(room,'primary-'+room);
  const start=()=>control.updateStudioDesired(room,joined.state.epoch,{onAir:true,videoCodec:'av1',simulcast:true});
  const mode=()=>control.updateStudioDesired(room,joined.state.epoch,{videoCodec:'h264',simulcast:false});
  const results=await Promise.all(reverse?[mode(),start()]:[start(),mode()]);
  assert.equal(results.filter(Boolean).length,1,'atomic ON AIR/mode race accepts exactly one winner in each queue order');
 }
 // Explicit saved choices (including live rooms) are never replaced by defaults.
 for(const codec of ['vp8','h264','av1']) {
  const room='saved-'+codec,joined=await control.joinStudio(room,'primary-saved-'+codec);
  assert.ok(await control.updateStudioDesired(room,joined.state.epoch,{videoCodec:codec,bitrate:1500}));
  assert.ok(await control.updateStudioDesired(room,joined.state.epoch,{onAir:true}));
  const restored=await control.joinStudio(room,'primary-saved-'+codec);
  assert.equal(restored.state.desired.videoCodec,codec);assert.equal(restored.state.desired.bitrate,1500);assert.equal(restored.state.desired.onAir,true);
 }
 // Legacy state receives added defaults without changing its former VP8 codec or saved bitrate.
 const saved=JSON.parse(fs.readFileSync(process.env.STUDIOLINK_STUDIO_CONTROL_FILE,'utf8'));delete saved.rooms['studio-b'].desired.videoCodec;delete saved.rooms['studio-b'].desired.simulcast;saved.rooms['studio-b'].desired.bitrate=8500;fs.writeFileSync(process.env.STUDIOLINK_STUDIO_CONTROL_FILE,JSON.stringify(saved));
 const legacy=await control.readStudioState('studio-b');assert.equal(legacy.desired.videoCodec,'vp8');assert.equal(legacy.desired.simulcast,true);assert.equal(legacy.desired.bitrate,8500);
 console.log('PASS: persisted isolated video mode defaults, 25Mbps limit, strict codec validation and desired/actual/transition OFFAIR guards');
}finally{fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1});
