import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const pinned=process.binding('natives')['internal/fs/utils'];
const checkBody=pinned.match(/(?:^|\n)Stats\.prototype\._checkModeProperty = function\(property\) \{([\s\S]*?)\n\};/);
assert.ok(checkBody,'real pinned numeric Stats implementation exists');
assert.match(checkBody[1],/\(this\.mode & S_IFMT\) === property/);
assert.doesNotMatch(checkBody[1],/BigInt/);
const checkMode=vm.runInNewContext('(function(property){'+checkBody[1]+'})',{isWindows:true,...fs.constants});
function windowsStat(mode){const stat=Object.create(fs.Stats.prototype);stat.mode=mode;stat._checkModeProperty=checkMode;return stat;}
const source=fs.readFileSync(new URL('../../native/primary-launcher/native-bootstrap.mjs',import.meta.url),'utf8');
async function run(change={}){const trace=[],errors=[],process={platform:'win32',env:{CASTLINK_NATIVE_REQUEST_FD:'3',CASTLINK_NATIVE_REPLY_FD:'4'},argv:['node','bootstrap','--help'],stderr:{write:b=>errors.push(b)},exitCode:undefined};Object.assign(process,change.process);let loads=0;const box={process,fs:{constants:fs.constants,fstatSync:fd=>{trace.push(fd);if(change.throwFD===fd)throw Object.assign(Error('private path must not leak'),{code:change.code});return windowsStat(change.modeFD===fd?change.mode:change.notFIFO===fd?fs.constants.S_IFREG:fs.constants.S_IFIFO);}},loadMain:()=>{loads++;return{entry:async()=>0};},loadBroker:()=>({windowsNativeBroker:{executeSync(){},openSession(){}}})};const body=source.replace(/^import[^\n]+\n/gm,'').replace("import('./cli/main.js')",'loadMain()').replace("import('./cli/windows-native-broker.js')",'loadBroker()');await vm.runInNewContext('(async()=>{'+body+'})()',box);return{process,trace,errors,loads};}
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

test('real pinned Windows Stats reports false despite raw FIFO mode',()=>{assert.equal(process.version,'v22.23.3');const stat=windowsStat(fs.constants.S_IFIFO);assert.equal(stat.isFIFO(),false);assert.equal(stat.mode & fs.constants.S_IFMT,fs.constants.S_IFIFO);});

for(const mode of [0,fs.constants.S_IFDIR,fs.constants.S_IFLNK,fs.constants.S_IFSOCK])test('non-pipe raw mode refuses '+mode,async()=>{const r=await run({modeFD:3,mode});assert.equal(r.process.exitCode,4);assert.equal(r.loads,0);assert.deepEqual(r.trace,[3]);assert.deepEqual(r.errors,[JSON.stringify({schemaVersion:1,bootstrapReason:4,errorCode:0})+'\n']);});
test('pipe permission bits do not change file type',async()=>{const r=await run({modeFD:3,mode:fs.constants.S_IFIFO|0o600});assert.equal(r.process.exitCode,0);assert.deepEqual(r.trace,[3,4]);});
