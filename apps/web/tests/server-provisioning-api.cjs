const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {randomUUID}=require('node:crypto'),{NextRequest}=require('next/server');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
process.env.CASTLINK_SESSION_SECRET='api-test-session-secret';
const {signAccess,roomVersion}=require('../lib/access.ts');
const creator=randomUUID(),other=randomUUID(),studioId='studio-default';
const rooms=[{name:'mine',creatorAccessId:creator,studioPasswordHash:'hash-mine'},{name:'other',creatorAccessId:other,studioPasswordHash:'hash-other'}];
const original=Module._load;let fingerprintCalls=0,capturedScope,generatedCalls=0,authorizedInput,updateInput,removed,removeBlocked=false,removeGuarded=false;
let profiles=[{id:"peer",label:"Reserve",origin:"https://8.8.8.8",installationId:randomUUID(),secret:"DO-NOT-EXPOSE",ca:"PRIVATE-CA",connectAddress:"10.0.0.1",scope:{kind:"installation"}}];
Module._load=function(name,parent,isMain){
 if(name==='../../../lib/server-profile-removal')return {connectionInUse:'Сначала сними подготовленный резерв и дождись завершения переноса. Подключение сохранено.',removeUnusedRoomServerPeer:async(peer,roomId,assertAuthorized)=>{await assertAuthorized();if(removeBlocked)throw Error('Сначала сними подготовленный резерв и дождись завершения переноса. Подключение сохранено.');removed={peerId:peer.id,roomId};}};
 if(name==='../../../lib/room-store')return {readRooms:async()=>rooms};
 if(name==='../../../lib/server-profiles')return {validateProvisioningHost:require('../../../scripts/server-profile-store.mjs').validateProvisioningHost,listRoomServerProfiles:async()=>profiles};
 if(name==='../../../lib/server-provisioning-ssh')return {probeSshFingerprint:async()=>{fingerprintCalls++;return 'SHA256:'+'A'.repeat(43);},generateSshKeyPair:async()=>{generatedCalls++;return {privateKey:'GENERATED-MEMORY-SECRET',publicKey:'ssh-rsa PUBLIC'};}};
 if(name==='../../../lib/server-provisioning')return {withServerPeerRemoval:async(roomId,installationId,operation)=>{removeGuarded=true;return operation();},startServerUpdate:(input,authorization)=>{updateInput={input,authorization};return {id:randomUUID(),state:'running',stage:'release'};},authorizeSshPublicKey:async(input,publicKey,generatedPrivateKey,assertAuthorized)=>{await assertAuthorized();authorizedInput={input,publicKey,generatedPrivateKey};return {ok:true};},startServerProvisioning:(input,scope)=>{capturedScope=scope;return {id:randomUUID(),state:'running',stage:'connecting'};},getServerProvisioningJob:()=>null};
 return original.call(this,name,parent,isMain);
};
const route=require('../app/api/server-provisioning/route.ts');Module._load=original;
function request(room='mine',body,cookieKind='creator'){
 const token=cookieKind==='owner'?signAccess({kind:'studio',version:'unused'},300):signAccess({kind:'room-studio',studio:studioId,id:creator,version:roomVersion('hash-mine')},300);
 const cookie=cookieKind==='owner'?'studiolink-studio':`castlink-room-studio-${roomVersion(creator).slice(0,24)}`;
 return new NextRequest('https://castlink.example/api/server-provisioning?room='+room+'&studioId='+studioId,{method:body?'POST':'GET',headers:{origin:'https://castlink.example',host:'castlink.example',cookie:cookie+'='+token,'content-type':'application/json'},...(body?{body:JSON.stringify({room,studioId,...body})}:{})});
}
test('catalog excludes secrets, CA and transport address; creator sees only own named room',async()=>{
 const response=await route.GET(request());assert.equal(response.status,200);
 const text=await response.text();assert.doesNotMatch(text,/DO-NOT-EXPOSE|PRIVATE-CA|connectAddress|10\.0\.0\.1/);
 assert.equal((await route.GET(request('other'))).status,401);
 assert.equal((await route.GET(request('mine',undefined,'owner'))).status,401);
});
test('public creator cannot probe private/loopback destinations or request installation scope',async()=>{
 for(const host of ['127.0.0.1','169.254.169.254','10.0.0.1'])assert.equal((await route.POST(request('mine',{action:'fingerprint',host,port:22}))).status,400);
 assert.equal(fingerprintCalls,0);
 const response=await route.POST(request('mine',{action:'start',host:'8.8.8.8',port:22,scope:{kind:'installation'},mode:'connect',label:'Reserve',password:'only-in-memory',fingerprint:'SHA256:'+'A'.repeat(43)}));
 assert.equal(response.status,202);assert.equal(capturedScope.roomId,creator);assert.equal(capturedScope.scope,undefined);
});

test('key generation and authorization keep room authorization and same-origin gates, return no-store and no secrets after authorization',async()=>{
 require('../lib/rate-limit.ts').resetRateLimitsForTests();
 assert.equal((await route.POST(request('other',{action:'generate-key'}))).status,401);assert.equal(generatedCalls,0);
 const crossOrigin=request('mine',{action:'generate-key'});crossOrigin.headers.set('origin','https://other.example');assert.equal((await route.POST(crossOrigin)).status,403);assert.equal(generatedCalls,0);
 const generated=await route.POST(request('mine',{action:'generate-key'}));assert.equal(generated.status,200);assert.equal(generated.headers.get('Cache-Control'),'no-store');assert.equal((await generated.json()).privateKey,'GENERATED-MEMORY-SECRET');assert.equal(generatedCalls,1);
 const authorized=await route.POST(request('mine',{action:'authorize-key',host:'8.8.8.8',port:22,password:'CURRENT-MEMORY-SECRET',fingerprint:'SHA256:'+'A'.repeat(43),publicKey:'ssh-rsa PUBLIC',generatedPrivateKey:'GENERATED-MEMORY-SECRET'}));assert.equal(authorized.status,200);assert.deepEqual(await authorized.json(),{ok:true});assert.equal(authorizedInput.input.password,'CURRENT-MEMORY-SECRET');assert.equal(authorizedInput.generatedPrivateKey,'GENERATED-MEMORY-SECRET');
 const excessive=await route.POST(request('mine',{action:'authorize-key',privateKey:'OVERSIZED-SECRET'.repeat(20000)}));assert.equal(excessive.status,400);assert.doesNotMatch(await excessive.text(),/OVERSIZED-SECRET/);
 const response=await route.POST(request('mine',{action:'start',host:'8.8.8.8',port:22,authType:'private-key',privateKey:'PRIVATE-MEMORY-SECRET',passphrase:'KEY-PASSPHRASE',fingerprint:'SHA256:'+'A'.repeat(43),mode:'deploy',label:'Reserve'}));assert.equal(response.status,202);assert.doesNotMatch(await response.text(),/PRIVATE-MEMORY-SECRET|KEY-PASSPHRASE/);
});

test('update binds public room-owned profile and rechecks identity without exposing secrets',async()=>{
 require('../lib/rate-limit.ts').resetRateLimitsForTests();
 const peer={id:randomUUID(),label:'Reserve',origin:'https://reserve.example',installationId:randomUUID(),connectAddress:'8.8.8.8',secret:'DO-NOT-EXPOSE',scope:{kind:'room',roomId:creator}};profiles=[peer];
 const catalog=await (await route.GET(request())).json();assert.deepEqual(catalog.profiles[0].update,{host:'8.8.8.8',port:22,installationId:peer.installationId});assert.equal(catalog.profiles[0].secret,undefined);
 const body={action:'update',peerId:peer.id,host:'8.8.8.8',port:2222,password:'MEMORY-ONLY',fingerprint:'SHA256:'+'A'.repeat(43),installationId:peer.installationId};
 assert.equal((await route.POST(request('mine',{...body,host:'9.9.9.9'}))).status,400);
 assert.equal((await route.POST(request('mine',{...body,installationId:randomUUID()}))).status,400);
 assert.equal((await route.POST(request('mine',body))).status,202);assert.equal(updateInput.input.host,'8.8.8.8');assert.equal(updateInput.input.port,2222);assert.equal(updateInput.authorization.peer.secret,peer.secret);
 await updateInput.authorization.assertAuthorized();profiles=[{...peer,secret:'rotated'}];await assert.rejects(updateInput.authorization.assertAuthorized);
});
test('update refuses installation-shared, foreign-room, unknown and private-address profiles',async()=>{
 const id=randomUUID(),installationId=randomUUID();const base={id,label:'Reserve',origin:'https://8.8.8.8',installationId,secret:'SECRET',scope:{kind:'room',roomId:creator}};
 for(const peer of [{...base,scope:{kind:'installation'}},{...base,scope:{kind:'room',roomId:other}},{...base,connectAddress:'127.0.0.1'}]){
  require('../lib/rate-limit.ts').resetRateLimitsForTests();profiles=[peer];updateInput=undefined;
  const catalog=await (await route.GET(request())).json();assert.equal(catalog.profiles[0].update,undefined);
  const response=await route.POST(request('mine',{action:'update',peerId:id,host:'8.8.8.8',port:22,password:'PASSWORD',fingerprint:'SHA256:'+'A'.repeat(43)}));assert.equal(response.status,400);assert.equal(updateInput,undefined);
 }
 profiles=[];assert.equal((await route.POST(request('mine',{action:'update',peerId:id,host:'8.8.8.8',port:22,password:'PASSWORD',fingerprint:'SHA256:'+'A'.repeat(43)}))).status,400);
});

test('removal requires explicit confirmation, same origin and current creator; shared and foreign profiles cannot be removed',async()=>{
 const peer={id:randomUUID(),installationId:randomUUID(),label:'Reserve',origin:'https://8.8.8.8',secret:'DO-NOT-EXPOSE',scope:{kind:'room',roomId:creator}};
 const deletion=(room='mine',changes={})=>{const req=request(room,{peerId:peer.id,confirm:true,...changes});return new NextRequest(req,{method:'DELETE'});};
 profiles=[peer];removed=undefined;removeGuarded=false;
 assert.equal((await route.DELETE(deletion('mine',{confirm:false}))).status,400);
 assert.equal((await route.DELETE(deletion('other'))).status,401);
 const cross=deletion();cross.headers.set('origin','https://foreign.example');assert.equal((await route.DELETE(cross)).status,403);assert.equal(removed,undefined);
 for(const scope of [{kind:'installation'},{kind:'room',roomId:other}]){profiles=[{...peer,scope}];assert.equal((await route.DELETE(deletion())).status,404);assert.equal(removed,undefined);}
 profiles=[peer];removeBlocked=true;assert.equal((await route.DELETE(deletion())).status,409);assert.equal(removed,undefined);
 removeBlocked=false;const response=await route.DELETE(deletion());assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(await response.json(),{removed:true});assert.equal(removeGuarded,true);assert.deepEqual(removed,{peerId:peer.id,roomId:creator});
});
