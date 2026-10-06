import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../native/primary-launcher/native-bootstrap.mjs',import.meta.url),'utf8');
async function run(change={}){const trace=[],errors=[],process={platform:'win32',env:{CASTLINK_NATIVE_REQUEST_FD:'3',CASTLINK_NATIVE_REPLY_FD:'4'},argv:['node','bootstrap','--help'],stderr:{write:b=>errors.push(b)},exitCode:undefined};Object.assign(process,change.process);let loads=0;const box={process,fs:{fstatSync:fd=>{trace.push(fd);if(change.throwFD===fd)throw Object.assign(Error('private path must not leak'),{code:change.code});return{isFIFO:()=>change.notFIFO!==fd};}},loadMain:()=>{loads++;return{entry:async()=>0};},loadBroker:()=>({windowsNativeBroker:{executeSync(){},openSession(){}}})};const body=source.replace(/^import[^\n]+\n/gm,'').replace("import('./cli/main.js')",'loadMain()').replace("import('./cli/windows-native-broker.js')",'loadBroker()');await vm.runInNewContext('(async()=>{'+body+'})()',box);return{process,trace,errors,loads};}
for(const [name,change,reason,errorCode,trace]of [
 ['platform',{process:{platform:'linux'}},1,0,[]],
 ['request environment',{process:{env:{CASTLINK_NATIVE_REQUEST_FD:'9',CASTLINK_NATIVE_REPLY_FD:'4'}}},2,0,[]],
 ['reply environment',{process:{env:{CASTLINK_NATIVE_REQUEST_FD:'3',CASTLINK_NATIVE_REPLY_FD:'9'}}},3,0,[]],
 ['request stat invalid',{throwFD:3,code:'EBADF'},4,1,[3]],
 ['request stat unknown',{throwFD:3,code:'arbitrary secret'},4,5,[3]],
 ['request type',{notFIFO:3},4,0,[3]],
 ['reply stat invalid',{throwFD:4,code:'EINVAL'},5,2,[3,4]],
 ['reply stat denied',{throwFD:4,code:'EACCES'},5,3,[3,4]],
 ['reply stat permission',{throwFD:4,code:'EPERM'},5,4,[3,4]],
 ['reply type',{notFIFO:4},5,0,[3,4]]])test(name,async()=>{const r=await run(change);assert.equal(r.process.exitCode,4);assert.equal(r.loads,0);assert.deepEqual(r.trace,trace);assert.deepEqual(r.errors,[JSON.stringify({schemaVersion:1,bootstrapReason:reason,errorCode})+'\n']);});
test('admitted channel still imports entry with same descriptors',async()=>{const r=await run();assert.equal(r.process.exitCode,0);assert.equal(r.loads,1);assert.deepEqual(r.trace,[3,4]);assert.deepEqual(r.errors,[]);});
