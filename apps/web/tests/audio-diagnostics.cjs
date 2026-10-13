const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const Module = require('node:module');
const original = Module._extensions['.ts'];
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-audio-history-'));
process.env.STUDIOLINK_STATS_DIR = directory;
const store = require('../lib/telemetry-store.ts');
const diagnostics = require('../lib/audio-diagnostics.ts');
const { audioHistoryCsv } = require('../lib/stats-csv.ts');
const { localNodeHistory } = require('../lib/node-history.ts');
const at = Date.now() - 10000;
const sample = (session, role = 'output', offset = 0) => ({at:at+offset,room:'media-tenant-one',identity:`${role}-${session}`,name:'Выход 🐻',session,
  role,state:'connected',quality:'excellent',reconnects:0,uptimeSec:20,streams:[
    {id:'audio-one',participant:'guest-one',kind:'audio',direction:'in',source:'microphone',bytes:100,bitrateKbps:40,lossPct:2,jitterMs:3,rttMs:20,
      audio:{receivedSamplesDelta:96000,concealedSamplesDelta:960,concealedPct:1,intervalMs:2000}},
    {id:'video-one',kind:'video',direction:'in',bitrateKbps:800}],audioPlayback:{enabled:true,paused:false,recoveryAttempts:2}});

let owner = true, admin = false;
let claims = {sub:'studio-panel-one',video:{room:'media-tenant-one'},metadata:JSON.stringify({studioId:'tenant-one',roomDisplayName:'Poker'})};
let authRoom = 'Poker', authStudio = 'tenant-one';
class NextResponse extends Response {static json(body, init){return new Response(JSON.stringify(body),init);}}
class TokenVerifier {async verify(token){if(token !== 'valid-token') throw Error('invalid');return claims;}}
const imports = {'next/server':{NextResponse},'livekit-server-sdk':{TokenVerifier},'@/lib/telemetry-store':store,
  '@/lib/audio-diagnostics':diagnostics,'@/lib/access':{isStudio:()=>owner,sameOrigin:()=>true},
  '@/lib/room-admin':{isRoomAdmin:async(_,room,studio)=>admin && room===authRoom && studio===authStudio},
  '@/lib/room-studio-access':{canHostNamedRoom:async(_,room,studio)=>owner && room===authRoom && studio===authStudio},
  '../../../lib/studio-scope':{defaultStudioId:()=> 'tenant-one',validateStudioId:value=>value,mediaRoomName:()=> 'media-tenant-one'}};
const loaded = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/api/stats/route.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {module:loaded,exports:loaded.exports,require:name=>{assert.ok(name in imports,name);return imports[name];},
    process:{env:{LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:'test-secret'}},Date,Error,Response,console});
const get = (query='', token='valid-token') => {
  const url=new URL('https://test/api/stats?diagnostics=audio&room=Poker&studioId=tenant-one');
  for(const [key,value] of new URLSearchParams(query)) url.searchParams.set(key,value);
  return loaded.exports.GET({nextUrl:url,headers:new Headers(token ? {authorization:`Bearer ${token}`} : {})});
};

(async()=>{
  const first = diagnostics.audioReceiveDiagnostic({timestamp:1000,totalSamplesReceived:1000,concealedSamples:100,concealmentEvents:2,jitterBufferDelay:2,jitterBufferEmittedCount:100});
  assert.equal(first.diagnostic.receivedSamplesDelta,null,'first sample has unknown deltas');
  const next = diagnostics.audioReceiveDiagnostic({timestamp:3000,totalSamplesReceived:11000,concealedSamples:1100,concealmentEvents:4,jitterBufferDelay:3,jitterBufferEmittedCount:200,audioLevel:0},first.counters).diagnostic;
  assert.equal(next.receivedSamplesDelta,10000); assert.equal(next.concealedSamplesDelta,1000);
  assert.equal(next.concealedPct,10,'received total already includes concealed samples');
  assert.equal(next.concealmentEventsDelta,2); assert.equal(next.jitterBufferDelayMs,10,'delay is interval delay/emitted, in ms');
  assert.equal(next.intervalMs,2000); assert.equal(next.audioLevel,0,'real silence remains zero');
  const reset = diagnostics.audioReceiveDiagnostic({timestamp:4000,totalSamplesReceived:10,concealedSamples:1},first.counters).diagnostic;
  assert.equal(reset.receivedSamplesDelta,null);assert.equal(reset.concealedPct,null);
  assert.equal(diagnostics.audioReceiveDiagnostic({timestamp:5000},first.counters).diagnostic.receivedSamplesDelta,null,'unsupported fields stay unknown');
  assert.equal(diagnostics.audioReceiveDiagnostic({timestamp:1000,totalSamplesReceived:2000},first.counters).diagnostic.receivedSamplesDelta,null,'repeated RTC timestamps do not imply progress');
  const clean = diagnostics.sanitizeAudioPlayback({enabled:true,paused:false,currentTime:0,errorCode:NaN,lastRecoveryReason:'https://secret/token',token:'secret'});
  assert.equal(clean.currentTime,0); assert.equal(clean.lastRecoveryReason,null); assert.equal(clean.token,undefined);
  assert.equal(diagnostics.sanitizeAudioReceive({concealedPct:500,audioLevel:50,receivedSamples:-1}).concealedPct,100);
  await store.saveSample(sample('other-session','guest'));
  for(let i=0;i<5;i++) await store.saveSample(sample('selected-session','output',i));
  await store.saveSample({...sample('foreign-session'),room:'media-tenant-two'});
  const all = [], fixedTo = Date.now(); let cursor;
  do {
    const page = await store.readAudioHistory('media-tenant-one',15,{session:'selected-session',role:'output',limit:2,cursor,to:fixedTo});
    assert.ok(page.samples.every(s=>s.session==='selected-session' && s.room==='media-tenant-one'));
    assert.ok(page.samples.every(s=>s.streams.every(t=>t.kind==='audio')),'detail omits unrelated video payload');
    all.push(...page.samples); cursor=page.nextCursor || undefined;
  } while(cursor);
  assert.deepEqual(all.map(s=>s.at),[0,1,2,3,4].map(i=>at+i),'UTF8 cursor pages have no omitted/duplicated samples');
  assert.equal((await store.readAudioHistory('media-tenant-two',15)).samples.length,1);
  assert.equal((await store.readAudioHistory('media-tenant-one',15,{identity:'missing'})).samples.length,0);
  await store.clearDisconnected('media-tenant-one');
  assert.equal((await store.readAudioHistory('media-tenant-one',15,{session:'selected-session'})).samples.length,5,'list reset does not erase detailed history');
  const history = await store.readHistory('media-tenant-one',15,'selected-session');
  assert.equal(history.audioSummary.samples,5);assert.equal(history.audioSummary.lossIntervals,5);assert.equal(history.audioSummary.concealmentIntervals,5);
  assert.equal(history.audioSummary.recoveryAttempts,2,'cumulative attempts are not summed across heartbeat samples');
  const exported = audioHistoryCsv(all);
  assert.ok(exported.includes(new Date(at+1).toISOString()));assert.ok(exported.includes('Concealed samples за интервал'));
  assert.equal(audioHistoryCsv([{...sample('older-record'),audioPlayback:undefined,streams:[{id:'old',kind:'audio',direction:'in'}]}]).includes('undefined'),false,'old records export without invented numbers');
  for (const options of [{limit:2001},{limit:0},{cursor:'../../other'},{cursor:'1:0'},{to:NaN}]) await assert.rejects(store.readAudioHistory('media-tenant-one',15,options),/invalid_audio_/);
  const sameTime = sample('same-time-session');
  for(let i=0;i<3;i++) await store.saveSample(sameTime);
  const sameA = await store.readAudioHistory('media-tenant-one',15,{session:sameTime.session,limit:1,to:fixedTo});
  const sameB = await store.readAudioHistory('media-tenant-one',15,{session:sameTime.session,limit:1,to:fixedTo,cursor:sameA.nextCursor});
  assert.notEqual(sameA.nextCursor,sameB.nextCursor,'cursor uses bytes, not timestamp, when multiple samples have identical times');
  assert.equal((await localNodeHistory(new URLSearchParams({room:'media-tenant-one',diagnostics:'audio',session:'selected-session',limit:'2'}))).samples.length,2);
  owner=false;assert.equal((await get('', '')).status,403);
  assert.equal((await get()).status,403,'JWT alone never grants diagnostics access');owner=true;
  assert.equal((await get('room=Other')).status,403);assert.equal((await get('studioId=tenant-two')).status,403);
  const primaryClaims = claims;
  owner=false;
  claims={...primaryClaims,sub:'guest-one'};assert.equal((await get()).status,403,'guest without a studio/admin session cannot fetch diagnostics');
  claims={...primaryClaims,sub:'studio-moderator-one',metadata:JSON.stringify({studioId:'tenant-one',roomDisplayName:'Poker',accessRole:'moderator'})};
  assert.equal((await get()).status,403,'moderator scope does not gain history access');
  claims=primaryClaims;
  owner=false;admin=true;assert.equal((await get()).status,200,'existing room admin can retrieve diagnostics');
  authRoom='RecreatedPoker';assert.equal((await get()).status,403,'revoked/recreated creator scope cannot read via old token');authRoom='Poker';owner=true;admin=false;
  assert.equal((await get('limit=5000')).status,400);assert.equal((await get('cursor=invalid')).status,400);
  const detailed=await (await get('session=selected-session&limit=2')).json();
  assert.equal(detailed.samples.length,2);assert.ok(detailed.nextCursor);
  const raw={...sample('ingest-session'),identity:claims.sub,audioPlayback:{enabled:true,lastRecoveryReason:'secret-url',secret:'secret'},at:12345,
    streams:[{id:'received-audio',kind:'audio',direction:'in',audio:{receivedSamplesDelta:5,secret:'secret'}}]};
  const post=await loaded.exports.POST({headers:new Headers({authorization:'Bearer valid-token'}),text:async()=>JSON.stringify(raw)});
  assert.equal(post.status,204);
  const stored=(await store.readAudioHistory('media-tenant-one',15,{session:'ingest-session'})).samples[0];
  assert.equal(stored.clientAt,12345);assert.ok(stored.at>at,'server sample timestamp is authoritative');
  assert.equal(stored.audioPlayback.secret,undefined);assert.equal(stored.audioPlayback.lastRecoveryReason,null);assert.equal(stored.streams[0].audio.secret,undefined);
  console.log('PASS: audio interval deltas/resets, concealment denominator, jitter buffer units, unsupported records, scoped byte-cursor pagination, exact UTC CSV, reset preserves history, summaries, node relay, API tenant/room/role/recreated-scope isolation, sanitized ingestion');
})().finally(()=>{fs.rmSync(directory,{recursive:true,force:true});if(original)Module._extensions['.ts']=original;else delete Module._extensions['.ts'];})
  .catch(error=>{console.error(error);process.exitCode=1;});
