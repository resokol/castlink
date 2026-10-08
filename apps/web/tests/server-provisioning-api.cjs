const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {randomUUID}=require('node:crypto'),{NextRequest}=require('next/server');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
process.env.CASTLINK_SESSION_SECRET='api-test-session-secret';
const {signAccess,roomVersion}=require('../lib/access.ts');
const creator=randomUUID(),other=randomUUID(),studioId='studio-default';
const rooms=[{name:'mine',creatorAccessId:creator,studioPasswordHash:'hash-mine'},{name:'other',creatorAccessId:other,studioPasswordHash:'hash-other'}];
const original=Module._load;let fingerprintCalls=0,capturedScope;
Module._load=function(name,parent,isMain){
 if(name==='../../../lib/room-store')return {readRooms:async()=>rooms};
 if(name==='../../../lib/server-profiles')return {validateProvisioningHost:require('../../../scripts/server-profile-store.mjs').validateProvisioningHost,listRoomServerProfiles:async()=>[{id:'peer',label:'Reserve',origin:'https://8.8.8.8',installationId:randomUUID(),secret:'DO-NOT-EXPOSE',ca:'PRIVATE-CA',connectAddress:'10.0.0.1',scope:{kind:'installation'}}]};
 if(name==='../../../lib/server-provisioning-ssh')return {probeSshFingerprint:async()=>{fingerprintCalls++;return 'SHA256:'+'A'.repeat(43);}};
 if(name==='../../../lib/server-provisioning')return {startServerProvisioning:(input,scope)=>{capturedScope=scope;return {id:randomUUID(),state:'running',stage:'connecting'};},getServerProvisioningJob:()=>null};
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
