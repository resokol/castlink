import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SetupTargetCursor,SetupTargetCursorError} from '../dist/setup-target-guard.js';

const id='12345678-1234-4234-8234-123456789abc',sid={kind:'windows-sid',sid:'S-1-5-21-100-200-300-1001'};
function fixture({windows=true,remote=false,root=windows?'D:\\CastLink proof\\bundle':'/srv/castlink',composePath=windows?'D:\\CastLink proof\\bundle\\compose.yaml':'/srv/castlink/compose.yaml',binding={}}={}){
 let calls=0;const generation={schemaVersion:1,active:false,engine:'owned-engine',epoch:7,principal:windows?sid:1001,scope:windows?'C:\\Users\\Owner\\.castlink-target-operations':'/home/operator/.castlink-target-operations',endpoint:windows?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock',...binding};
 const cursor=new SetupTargetCursor(structuredClone(generation),{run:async()=>{calls++;throw Error('No effects allowed')}},remote,false);
 // Test-only trusted attachment seam: bypass filesystem/native private ACLs,
 // without adding any production setter or pretending attachment was exercised.
 cursor.profile={schemaVersion:1,installationId:id,request:{profile:'proof',target:remote?{kind:'remote',alias:'fixture'}:{kind:'local'},root,release:'1.0.0',network:'loopback'},currentRelease:'1.0.0',secretFilePaths:{}};
 const contract={installationId:id,composePath,project:'castlink-proof',hashes:{web:'a'.repeat(64)}};
 const resources={containers:[{Id:'b'.repeat(64),Image:'sha256:'+'c'.repeat(64),Labels:{'com.docker.compose.service':'web'}}]};
 const hashes={'compose.yaml':'d'.repeat(64)},run=()=>cursor.sqlGuard('database',contract,resources,hashes);
 return {cursor,generation,contract,resources,hashes,run,calls:()=>calls};
}
test('SID-bound factory accepts exact canonical D compose path and retains every authority field',()=>{
 const f=fixture(),g=f.run();assert.deepEqual(g.operation,{schemaVersion:1,kind:'database',root:'D:\\CastLink proof\\bundle',installationId:id,engine:'owned-engine',epoch:7,principal:sid,scope:'C:\\Users\\Owner\\.castlink-target-operations'});assert.equal(g.endpoint,f.generation.endpoint);assert.equal(g.containerId,'b'.repeat(64));assert.equal(g.containerImage,'sha256:'+'c'.repeat(64));assert.equal(g.configHash,'a'.repeat(64));assert.deepEqual(g.fileHashes,f.hashes);assert.equal(f.calls(),0);
 g.operation.principal.sid='changed';g.fileHashes['compose.yaml']='changed';assert.deepEqual(f.cursor.binding.principal,sid);assert.equal(f.hashes['compose.yaml'],'d'.repeat(64));
});
test('Windows factory rejects POSIX mixed foreign or normalized-adopted compose paths',()=>{
 for(const composePath of ['D:\\CastLink proof\\bundle/compose.yaml','D:/CastLink proof/bundle/compose.yaml','D:\\foreign\\compose.yaml','D:\\CastLink proof\\bundle\\x\\..\\compose.yaml'])assert.throws(fixture({composePath}).run,e=>e instanceof SetupTargetCursorError&&e.code===4);
 for(const root of ['D:/CastLink proof/bundle','D:\\CastLink proof\\x\\..\\bundle','/srv/castlink','D:\\'])assert.throws(fixture({root,composePath:root+'\\compose.yaml'}).run,e=>e instanceof SetupTargetCursorError&&e.code===4);
});
test('UID remote Ubuntu factory remains POSIX independently of operator platform',()=>{
 const original=Object.getOwnPropertyDescriptor(process,'platform');try{Object.defineProperty(process,'platform',{value:'win32'});const f=fixture({windows:false,remote:true}),g=f.run();assert.equal(g.operation.root,'/srv/castlink');assert.equal(g.operation.principal,1001);assert.equal(g.operation.scope,'/home/operator/.castlink-target-operations');assert.equal(g.endpoint,'unix:///var/run/docker.sock');assert.equal(g.operation.epoch,7);assert.equal(f.calls(),0);}finally{Object.defineProperty(process,'platform',original)}
 assert.throws(fixture({windows:false,remote:true,composePath:'/srv/castlink\\compose.yaml'}).run,e=>e instanceof SetupTargetCursorError&&e.code===4);
});
test('factory refuses foreign principal shape and cross-platform scope/endpoint bindings',()=>{
 for(const binding of [{principal:{kind:'foreign',sid:sid.sid}},{principal:{...sid,extra:true}},{principal:{kind:'windows-sid',sid:'foreign'}},{principal:null},{principal:'1001'},{scope:'/home/operator/.castlink-target-operations'},{endpoint:'unix:///var/run/docker.sock'}])assert.throws(fixture({binding}).run,e=>e instanceof SetupTargetCursorError&&e.code===4);
 assert.throws(fixture({remote:true}).run,e=>e instanceof SetupTargetCursorError&&e.code===4);
 for(const binding of [{principal:-1},{principal:1.5},{scope:'D:\\Owner\\.castlink-target-operations'},{endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine'}])assert.throws(fixture({windows:false,remote:true,binding}).run,e=>e instanceof SetupTargetCursorError&&e.code===4);
});
