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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-runtime-history-'));
process.env.STUDIOLINK_STATS_DIR = directory;
const store = require('../lib/telemetry-store.ts');
const runtime = require('../lib/runtime-diagnostics.ts');
const { localNodeHistory } = require('../lib/node-history.ts');
const at = Date.now() - 10000;
const diagnostic = {visibility:'visible',browser:'firefox',environment:'desktop',loopLagMs:0,maxLoopLagMs:350,longTasks:null,
  longTaskMaxMs:null,heapUsedBytes:null,heapLimitBytes:null,errors:0,rejections:1,events:[{at:123,kind:'started'}]};
const sample = (session, offset=0) => ({at:at+offset,room:'media-tenant-one-Poker',identity:'studio-panel-one',name:'Студия 🐻',session,
  role:'studio',state:'connected',quality:'excellent',reconnects:0,uptimeSec:20,streams:[],runtime:{...diagnostic,loopLagMs:offset}});
let owner = true, admin = false, authRoom = 'Poker', authStudio = 'tenant-one';
let claims = {sub:'studio-panel-one',video:{room:'media-tenant-one-Poker'},metadata:JSON.stringify({studioId:'tenant-one',roomDisplayName:'Poker'})};
class NextResponse extends Response {static json(body, init){return new Response(JSON.stringify(body),init);}}
class TokenVerifier {async verify(token){if(token !== 'valid-token') throw Error('invalid');return claims;}}
const imports = {'next/server':{NextResponse},'livekit-server-sdk':{TokenVerifier},'@/lib/telemetry-store':store,
  '@/lib/runtime-diagnostics':runtime,'@/lib/audio-diagnostics':require('../lib/audio-diagnostics.ts'),
  '@/lib/access':{isStudio:()=>owner,sameOrigin:()=>true},
  '@/lib/room-admin':{isRoomAdmin:async(_,room,studio)=>admin && room===authRoom && studio===authStudio},
  '@/lib/room-studio-access':{canHostNamedRoom:async(_,room,studio)=>owner && room===authRoom && studio===authStudio},
  '../../../lib/studio-scope':{defaultStudioId:()=> 'tenant-one',validateStudioId:value=>value,
    mediaRoomName:(studio,room)=>`media-${studio}-${room}`}};
const loaded = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/api/stats/route.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {module:loaded,exports:loaded.exports,require:name=>{assert.ok(name in imports,name);return imports[name];},
    process:{env:{LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:'test-secret'}},Date,Error,Response,console});
const get = (query='', token='valid-token') => {
  const url=new URL('https://test/api/stats?diagnostics=runtime&room=Poker&studioId=tenant-one');
  for(const [key,value] of new URLSearchParams(query)) url.searchParams.set(key,value);
  return loaded.exports.GET({nextUrl:url,headers:new Headers(token ? {authorization:`Bearer ${token}`} : {})});
};
const post = (raw, token='valid-token') => loaded.exports.POST({headers:new Headers(token ? {authorization:`Bearer ${token}`} : {}),text:async()=>JSON.stringify(raw)});
(async()=>{
  assert.equal(typeof store.readRuntimeHistory, 'function', 'runtime history must expose exact paginated samples');
  await store.saveSample({...sample('foreign-room-session'),room:'media-tenant-one-Other'});
  await store.saveSample({...sample('foreign-tenant-session'),room:'media-tenant-two-Poker'});
  await store.saveSample({...sample('guest-runtime-session'),identity:'guest-one',role:'guest'});
  await store.saveSample({...sample('admin-runtime-session'),identity:'studio-moderator-one',role:'admin'});
  await store.saveSample({...sample('ordinary-studio-session'),runtime:undefined});
  await store.saveSample({...sample('malformed-runtime-session'),runtime:{visibility:'secret'}});
  await store.saveSample({...sample('malformed-identity-session'),identity:42});
  for(let i=0;i<5;i++) await store.saveSample(sample('selected-session',i));
  const fixedTo = Date.now(), all=[]; let cursor;
  do {
    const page = await store.readRuntimeHistory('media-tenant-one-Poker',15,{limit:2,cursor,to:fixedTo});
    assert.deepEqual(Object.keys(page).sort(),['from','limited','nextCursor','samples','to']);
    assert.ok(page.samples.every(s=>s.identity==='studio-panel-one' && s.role==='studio' && s.room==='media-tenant-one-Poker'));
    all.push(...page.samples);cursor=page.nextCursor || undefined;
  } while(cursor);
  assert.deepEqual(all.map(s=>s.at),[0,1,2,3,4].map(i=>at+i),'UTF8 byte cursor includes all exact runtime samples');
  assert.deepEqual(all.map(s=>s.runtime.loopLagMs),[0,1,2,3,4]);
  const localPage = await localNodeHistory(new URLSearchParams({room:'media-tenant-one-Poker',diagnostics:'runtime',session:'selected-session',limit:'2'}));
  assert.ok(Array.isArray(localPage.samples),'runtime node history must return samples');
  assert.equal(localPage.samples.length,2,'node history routes runtime diagnostics to exact samples');
  assert.ok(localPage.samples.every(s=>s.runtime));
  assert.equal((await store.readRuntimeHistory('media-tenant-one-Poker',15,{session:'missing'})).samples.length,0);
  assert.equal((await store.readRuntimeHistory('media-tenant-one-Poker',15,{identity:'guest-one'})).samples.length,0);
  assert.equal((await store.readRuntimeHistory('media-tenant-one-Poker',15,{role:'admin'})).samples.length,0);
  await store.clearDisconnected('media-tenant-one-Poker');
  assert.equal((await store.readRuntimeHistory('media-tenant-one-Poker',15)).samples.length,5,'reset retains runtime history');
  for(const options of [{limit:0},{limit:2001},{limit:1.5},{cursor:'../../other'},{cursor:'1:0'},{to:NaN}]) {
    await assert.rejects(store.readRuntimeHistory('media-tenant-one-Poker',15,options),/invalid_(runtime|audio)_/);
  }
  await assert.rejects(store.readRuntimeHistory('media-tenant-one-Poker',5),/invalid_runtime_/);
  owner=false;
  assert.equal((await get('', '')).status,403);assert.equal((await get()).status,403,'JWT grants no history capability');
  claims={...claims,sub:'guest-one'};assert.equal((await get()).status,403);
  claims={...claims,sub:'studio-moderator-one'};assert.equal((await get()).status,403);
  owner=true;
  assert.equal((await get('room=Other')).status,403);assert.equal((await get('studioId=tenant-two')).status,403);
  owner=false;admin=true;assert.equal((await get()).status,200,'room admin capability can read diagnostics');
  authRoom='RecreatedPoker';assert.equal((await get()).status,403,'old room scope grants no access after recreation');authRoom='Poker';
  owner=true;admin=false;
  for(const query of ['limit=2001','cursor=invalid','to=NaN','session=bad','role=superhero','minutes=5']) assert.equal((await get(query)).status,400,query);
  const page=await (await get('session=selected-session&limit=2')).json();
  assert.equal(page.samples.length,2);assert.ok(page.nextCursor);assert.equal(page.limited,true);assert.equal(page.summary,undefined);
  assert.equal((await post(sample('invalid-token-session'),'invalid')).status,401);
  claims={...claims,sub:'studio-panel-one'};
  assert.equal((await post({...sample('mismatch-room-session'),room:'media-tenant-two-Poker'})).status,400);
  assert.equal((await post({...sample('mismatch-identity-session'),identity:'studio-panel-another'})).status,400);
  const raw={...sample('ingest-runtime-session'),at:12345,runtime:{...diagnostic,token:'secret',message:'secret',events:[{at:1,kind:'error',message:'secret'}]}};
  assert.equal((await post(raw)).status,204);
  const stored=(await store.readRuntimeHistory('media-tenant-one-Poker',15,{session:raw.session})).samples[0];
  assert.equal(stored.clientAt,12345);assert.ok(stored.at>at);assert.equal(stored.runtime.token,undefined);
  assert.deepEqual(stored.runtime.events,[{at:1,kind:'error'}]);assert.equal(JSON.stringify(stored.runtime).includes('secret'),false);
  assert.equal((await post({...sample('ingest-invalid-session'),runtime:[]})).status,204);
  assert.equal((await store.readHistory('media-tenant-one-Poker',15,'ingest-invalid-session')).connections[0].latest.runtime,undefined);
  for(const [identity,role] of [['guest-one','guest'],['output-one','output'],['monitor-one','monitor'],['studio-moderator-one','moderator']]) {
    claims={...claims,sub:identity};
    const body={...sample(`ingest-${role}-session`),identity,role:'studio',runtime:diagnostic};
    assert.equal((await post(body)).status,204);
    const latest=(await store.readHistory(body.room,15,body.session)).connections[0].latest;
    assert.equal(latest.role,role,'role derives from verified identity');assert.equal(latest.runtime,undefined,'only primary studio stores runtime');
  }
  claims={...claims,sub:'studio-moderator-admin',metadata:JSON.stringify({studioId:'tenant-one',roomDisplayName:'Poker',accessRole:'admin'})};
  assert.equal((await post({...sample('ingest-admin-session'),identity:claims.sub})).status,204);
  assert.equal((await store.readHistory('media-tenant-one-Poker',15,'ingest-admin-session')).connections[0].latest.runtime,undefined);
  const archiveRoom='runtime-archive-room',hour=Math.floor((Date.now()-3*86400000)/3600000),to=(hour+1)*3600000;
  const archivedSamples=Array.from({length:5},(_,index)=>({...sample('archived-runtime-session',index),room:archiveRoom,at:hour*3600000+1000+index*2000}));
  for(const archivedSample of archivedSamples) await store.saveSample(archivedSample);
  const firstArchivePage=await store.readRuntimeHistory(archiveRoom,60,{limit:2,to});
  const archiveDirectory=path.join(directory,require('node:crypto').createHash('sha256').update(archiveRoom).digest('hex'));
  const {archiveTelemetryHour,telemetryHours}=require('../lib/telemetry-archives.ts');
  await archiveTelemetryHour((await telemetryHours(archiveDirectory))[0]);
  const afterArchive=await store.readRuntimeHistory(archiveRoom,60,{to,cursor:firstArchivePage.nextCursor});
  assert.deepEqual(JSON.parse(JSON.stringify([...firstArchivePage.samples,...afterArchive.samples])),archivedSamples,'runtime samples and byte cursor survive raw-to-gzip archival exactly');
  console.log('PASS: exact runtime history, byte pagination, tenant/room/session/identity/role isolation, history authorization, and primary-only sanitized ingestion');
})().finally(()=>{fs.rmSync(directory,{recursive:true,force:true});if(original)Module._extensions['.ts']=original;else delete Module._extensions['.ts'];})
  .catch(error=>{console.error(error);process.exitCode=1;});
