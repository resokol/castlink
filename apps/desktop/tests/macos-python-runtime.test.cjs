'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),zlib=require('node:zlib');
const runtime=require('../scripts/macos-python-runtime.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function archive(entries){
  const chunks=[];
  for(const {name,body='',type='0',link='',mode=0o644} of entries){
    const bytes=Buffer.from(body),header=Buffer.alloc(512);
    header.write(name,0,100);header.write(mode.toString(8).padStart(7,'0')+'\0',100,8);
    header.write(bytes.length.toString(8).padStart(11,'0')+'\0',124,12);
    header.fill(32,148,156);header.write(type,156,1);header.write(link,157,100);header.write('ustar\0',257,6);
    header.write([...header].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148,8);
    chunks.push(header,bytes,Buffer.alloc((512-bytes.length%512)%512));
  }
  return zlib.gzipSync(Buffer.concat([...chunks,Buffer.alloc(1024)]));
}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-python-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function macho(arch){const bytes=Buffer.alloc(32);bytes.writeUInt32LE(0xfeedfacf);bytes.writeUInt32LE(arch==='arm64'?0x100000c:0x1000007,4);return bytes;}
test('runtime pins are separate immutable macOS CPython 3.12 release assets',()=>{
  assert.equal(runtime.PYTHON_RELEASE,'20251031');
  for(const arch of ['arm64','x64']){
    const pin=runtime.MAC_PYTHON_RUNTIMES[arch];assert.match(pin.url,/^https:\/\/github.com\/astral-sh\/python-build-standalone\/releases\/download\/20251031\//);
    assert.match(pin.url,new RegExp(arch==='arm64'?'aarch64-apple-darwin':'x86_64-apple-darwin'));
    assert.match(pin.sha256,/^[a-f0-9]{64}$/);assert.equal(pin.version,'3.12.12');
  }
  assert.notEqual(runtime.MAC_PYTHON_RUNTIMES.arm64.sha256,runtime.MAC_PYTHON_RUNTIMES.x64.sha256);
});
test('downloads are checked against the pinned digest before any extraction',async t=>{
  const resourcesPath=fixture(t),calls=[];
  await assert.rejects(runtime.stageMacPythonRuntime({resourcesPath,arch:'arm64',platform:'darwin',hostArch:'arm64',fetchImpl:async url=>{calls.push(url);return new Response(archive([{name:'python/bin/python3',body:'wrong'}]));}}),/SHA-256 mismatch/);
  assert.deepEqual(calls,[runtime.MAC_PYTHON_RUNTIMES.arm64.url]);assert.equal(fs.existsSync(path.join(resourcesPath,'setup/python')),false);
});
test('archive extraction preserves executable modes, license and internal symlinks',t=>{
  const target=path.join(fixture(t),'runtime');
  const bytes=archive([{name:'python/bin/python3.12',body:'interpreter',mode:0o755},{name:'python/bin/python3',type:'2',link:'python3.12'},{name:'python/lib/python3.12/LICENSE.txt',body:'Python Software Foundation License'}]);
  runtime.extractPythonArchive(bytes,target);
  assert.equal(fs.readFileSync(path.join(target,'python/bin/python3'),'utf8'),'interpreter');
  assert.equal(fs.lstatSync(path.join(target,'python/bin/python3')).isSymbolicLink(),true);
  assert.equal(fs.readlinkSync(path.join(target,'python/bin/python3')),'python3.12');
  assert.equal(fs.statSync(path.join(target,'python/bin/python3.12')).mode&0o777,0o755);
  assert.match(fs.readFileSync(path.join(target,'python/lib/python3.12/LICENSE.txt'),'utf8'),/Foundation/);
});
test('rejects escaping members, escaping links, link parents, duplicate entries and special files before writing',t=>{
  const root=fixture(t);
  const cases=[
    [{name:'../outside',body:'escape'}], [{name:'/tmp/escape',body:'escape'}], [{name:'python/../outside',body:'escape'}],
    [{name:'python\\..\\outside',body:'escape'}], [{name:'other/bin/python3',body:'wrong root'}],
    [{name:'python/bin/python3',type:'2',link:'../../../outside'}], [{name:'python/bin/python3',type:'2',link:'/usr/bin/python3'}],
    [{name:'python/bin',type:'2',link:'lib'},{name:'python/bin/evil',body:'escape'},{name:'python/lib/file',body:'file'}],
    [{name:'python/a',body:'first'},{name:'python/a',body:'second'}], [{name:'python/device',type:'3'}],
    [{name:'python/a',type:'2',link:'b'},{name:'python/b',type:'2',link:'a'}],
    [{name:'python/a',type:'1',link:'../../outside'}]
  ];
  for(const [i,entries] of cases.entries()){
    const destination=path.join(root,'case-'+i);
    assert.throws(()=>runtime.extractPythonArchive(archive(entries),destination),/Unsafe|Unsupported|Duplicate|symlink|symbolic|cycle/i,JSON.stringify(entries));
    assert.equal(fs.existsSync(destination),false,'invalid archives must not be partly extracted');
  }
});
test('rejects damaged tar headers and truncated tar payloads',t=>{
  const root=fixture(t),bytes=archive([{name:'python/bin/python3',body:'data'}]);
  const tar=zlib.gunzipSync(bytes);tar[0]^=1;
  assert.throws(()=>runtime.extractPythonArchive(zlib.gzipSync(tar),path.join(root,'bad')),/checksum/);
  assert.throws(()=>runtime.extractPythonArchive(zlib.gzipSync(zlib.gunzipSync(bytes).subarray(0,513)),path.join(root,'short')),/Truncated/);
});
test('native Mach-O architecture and Python identity must both match the target',()=>{
  for(const arch of ['arm64','x64']){
    assert.doesNotThrow(()=>runtime.validatePythonArchitecture(macho(arch),arch));
    assert.throws(()=>runtime.validatePythonArchitecture(macho(arch),arch==='arm64'?'x64':'arm64'),/architecture/);
    assert.doesNotThrow(()=>runtime.validatePythonIdentity({version:'3.12.12',machine:arch==='arm64'?'arm64':'x86_64',system:'Darwin'},arch,'3.12.12'));
  }
  assert.throws(()=>runtime.validatePythonArchitecture(Buffer.from('not a Mach-O executable'),'arm64'),/Mach-O/);
  assert.throws(()=>runtime.validatePythonIdentity({version:'3.12.12',machine:'x86_64',system:'Darwin'},'arm64','3.12.12'),/architecture/);
  assert.throws(()=>runtime.validatePythonIdentity({version:'3.11.0',machine:'arm64',system:'Darwin'},'arm64','3.12.12'),/version/);
});
test('staging requires a native macOS build and an empty runtime destination',async t=>{
  const resourcesPath=fixture(t),fetchImpl=()=>assert.fail('must reject before downloading');
  for(const options of [{platform:'linux',hostArch:'arm64',arch:'arm64'},{platform:'darwin',hostArch:'x64',arch:'arm64'},{platform:'darwin',hostArch:'arm64',arch:'universal'},{platform:'darwin',hostArch:'constructor',arch:'constructor'}])await assert.rejects(runtime.stageMacPythonRuntime({resourcesPath,fetchImpl,...options}),/macOS|architecture/);
  fs.mkdirSync(path.join(resourcesPath,'setup/python'),{recursive:true});
  await assert.rejects(runtime.stageMacPythonRuntime({resourcesPath,platform:'darwin',hostArch:'arm64',arch:'arm64',fetchImpl}),/already exists/);
});
test('checksum helper refuses any bytes other than the approved artifact',()=>{
  const bytes=Buffer.from('approved');assert.doesNotThrow(()=>runtime.verifyArchiveChecksum(bytes,digest(bytes)));
  assert.throws(()=>runtime.verifyArchiveChecksum(Buffer.from('different'),digest(bytes)),/SHA-256 mismatch/);
});
