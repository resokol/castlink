const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let allowed=true,nodeId='remote',relayData={nodeId:'remote',history:{from:1,to:2,samples:[{runtime:{visibility:'visible'}}],nextCursor:null,limited:false}};
let remoteCalls=0,localCalls=0,lastPath='';
class NextResponse extends Response {static json(body,init){return new Response(JSON.stringify(body),init);}}
const imports={'next/server':{NextResponse},'../../../../lib/super-admin-access':{isSuperAdmin:async()=>allowed},
  '../../../../lib/control-plane-store':{listControlNodes:async()=>[{nodeId,endpoint:'https://node.test'}]},
  '../../../../lib/node-request':{ownNodeId:()=> 'local',signedNodeFetch:async(endpoint,id,path)=>{assert.equal(endpoint,'https://node.test');assert.equal(id,'remote');remoteCalls++;lastPath=path;return relayData;}},
  '../../../../lib/node-history':{localNodeHistory:async params=>{localCalls++;assert.equal(params.get('diagnostics'),'runtime');assert.equal(params.get('room'),'media-tenant-one-Poker');return relayData.history;}},
  '../../../../lib/rate-limit':{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})}};
const loaded={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/api/super-admin/history/route.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {module:loaded,exports:loaded.exports,require:name=>{assert.ok(name in imports,name);return imports[name];},URLSearchParams,Response,Error});
const get=(diagnostics='runtime')=>loaded.exports.GET({nextUrl:new URL(`https://test/api/super-admin/history?nodeId=${nodeId}&room=media-tenant-one-Poker&diagnostics=${diagnostics}&limit=2&cursor=100:12&to=1234&session=some-session&participant=studio-panel-one&role=studio`)});
(async()=>{
  const response=await get();assert.equal(response.status,200,'remote runtime history accepts samples response');
  assert.deepEqual(await response.json(),relayData.history);assert.equal(response.headers.get('Cache-Control'),'no-store');
  const forwarded=new URL('https://node.test'+lastPath).searchParams;
  for(const [key,value] of Object.entries({room:'media-tenant-one-Poker',diagnostics:'runtime',limit:'2',cursor:'100:12',to:'1234',session:'some-session',participant:'studio-panel-one',role:'studio'})) assert.equal(forwarded.get(key),value);
  allowed=false;const before=remoteCalls;assert.equal((await get()).status,403);assert.equal(remoteCalls,before,'unauthorized request never reaches node');allowed=true;
  relayData={...relayData,nodeId:'another-node'};assert.equal((await get()).status,503,'relay cannot substitute a different node');
  relayData={nodeId:'remote',history:{connections:[],series:[]}};assert.equal((await get()).status,503,'runtime response must contain samples');
  relayData={nodeId:'remote',history:{samples:[]}};assert.equal((await get('audio')).status,200,'audio detailed relay remains supported');
  assert.equal((await get('')).status,503,'aggregate history keeps connections/series validation');
  relayData={nodeId:'remote',history:{connections:[],series:[]}};assert.equal((await get('')).status,200);
  relayData={nodeId:'local',history:{from:1,to:2,samples:[],nextCursor:null,limited:false}};nodeId='local';
  assert.equal((await get()).status,200);assert.equal(localCalls,1,'own-node runtime history uses local path');
  console.log('PASS: super-admin runtime history relay, node identity validation, query forwarding, owner-node routing, and unchanged authorization/audio/aggregate validation');
})().catch(error=>{console.error(error);process.exitCode=1;});
