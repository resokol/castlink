import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {stdout} from 'node:process';
// Only host facts and the guarded module URL are substituted. The imported CLI
// module and entry implementation are the actual compiled production module.
const source=fs.readFileSync(new URL('../../native/primary-launcher/native-bootstrap.mjs',import.meta.url),'utf8');
const realMain=await import('../../apps/cli/dist/main.js');
async function run(channel,args){let loads=0;const messages=[],output=[],process={platform:'win32',argv:['checked-node','native-bootstrap.mjs',...args],env:channel?{CASTLINK_NATIVE_REQUEST_FD:'3',CASTLINK_NATIVE_REPLY_FD:'4'}:{},stderr:{write:b=>messages.push(b)},exitCode:undefined};const box={process,fs:{fstatSync:n=>({isFIFO:()=>channel&&(n===3||n===4)})},loadMain:()=>{loads++;return realMain;}};const body=source.replace(/^import[^\n]+\n/gm,'').replace("import('./cli/main.js')",'loadMain()');const write=stdout.write;stdout.write=function(value){output.push(String(value));return true;};try{await vm.runInNewContext('(async()=>{'+body+'})()',box);}finally{stdout.write=write;}return{loads,process,messages,output:output.join('')};}
test('admitted bootstrap invokes real main with CLI arguments and propagates help exit',async()=>{const r=await run(true,['--help']);assert.equal(r.loads,1);assert.equal(r.process.exitCode,0);assert.match(r.output,/castlink/);assert.deepEqual(r.messages,[]);});
test('admitted bootstrap forwards invalid command and propagates real parser refusal',async()=>{const r=await run(true,['not-a-command']);assert.equal(r.process.exitCode,2);assert.ok(r.output.length>0);});
test('ordinary direct Node missing inherited capability refuses before CLI import',async()=>{const r=await run(false,['--help']);assert.equal(r.loads,0);assert.equal(r.process.exitCode,4);assert.equal(r.output,'');assert.deepEqual(r.messages,['CastLink native Windows operation provider is unverified.\n']);});
test('importing actual main from a different entry does not auto dispatch',()=>{assert.equal(process.exitCode,undefined);});
