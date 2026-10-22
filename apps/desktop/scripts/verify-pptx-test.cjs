'use strict';
// Read-only verification of the actual private candidate and its source snapshot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {isPackageFile}=require('./package-files.cjs');
const {LAUNCHERS,launcherText}=require('./package-pptx-test.cjs');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function readAsar(archive){
  const fd=fs.openSync(archive,'r'),size=Buffer.alloc(8);fs.readSync(fd,size,0,8,0);
  const headerSize=size.readUInt32LE(4);assert.ok(headerSize>8&&headerSize<16*1024*1024);
  const raw=Buffer.alloc(headerSize);fs.readSync(fd,raw,0,headerSize,8);
  const header=JSON.parse(raw.subarray(8,8+raw.readUInt32LE(4)).toString('utf8'));
  return{read(file){
    let entry=header;for(const part of file.split('/'))entry=entry.files?.[part];
    assert.ok(entry&&!entry.link&&!entry.unpacked,'Expected packed regular file '+file);
    const bytes=Buffer.alloc(entry.size);fs.readSync(fd,bytes,0,bytes.length,8+headerSize+Number(entry.offset));return bytes;
  },close:()=>fs.closeSync(fd)};
}
function verify(output,root=path.resolve(__dirname,'../../..')){
  output=path.resolve(output);
  const manifestBytes=fs.readFileSync(path.join(output,'manifest.json')),info=JSON.parse(manifestBytes);
  assert.equal(info.testBuild,true);assert.equal(info.track,'pptx-private-test');
  for(const field of ['updateChecks','manualUpdate','serverSetup','protocolRegistration'])assert.equal(info[field],false,field);
  assert.equal(info.sourceKind,'working-tree-snapshot');
  assert.equal(info.packagingScriptSha256,digest(fs.readFileSync(path.join(root,'apps/desktop/scripts/package-pptx-test.cjs'))));
  assert.equal(info.nativeAudioSourceSha256,digest(fs.readFileSync(path.join(root,'native/windows-process-audio/ProcessAudio.cs'))));
  const inventory=JSON.parse(fs.readFileSync(path.join(output,'snapshot-files.json')));
  assert.equal(info.sourceSnapshotSha256,digest(JSON.stringify(inventory)));
  const unpacked=path.join(output,'win-unpacked'),archive=readAsar(path.join(unpacked,'resources/app.asar'));
  try{
    assert.deepEqual(archive.read('build-info.json'),manifestBytes);
    assert.deepEqual(archive.read('snapshot-files.json'),fs.readFileSync(path.join(output,'snapshot-files.json')));
    for(const item of inventory){
      const resource=item.file.startsWith('native-resources/');
      const bytes=resource?fs.readFileSync(path.join(unpacked,'resources',item.file.slice('native-resources/'.length))):archive.read(item.file);
      assert.equal(digest(bytes),item.sha256,item.file+' actual package bytes');
      let source;
      if(/^(src|ui|assets)\//.test(item.file))source=path.join(root,'apps/desktop',item.file);
      else if(['LICENSE','THIRD_PARTY_NOTICES'].includes(item.file))source=path.join(root,item.file);
      else if(item.file==='native-resources/powerpoint/Control.ps1')source=path.join(root,'native/windows-powerpoint/Control.ps1');
      if(source)assert.equal(digest(fs.readFileSync(source)),item.sha256,item.file+' current source must equal snapshot');
    }
    for(const folder of ['src','ui','assets'])for(const name of fs.readdirSync(path.join(root,'apps/desktop',folder))){
      const file=folder+'/'+name;if(isPackageFile(file))assert.ok(inventory.some(item=>item.file===file),'Runtime file missing from snapshot '+file);
    }
    const pkg=JSON.parse(archive.read('package.json'));assert.equal(pkg.name,'castlink-pptx-private-test');assert.match(pkg.version,/pptx-test/);
    assert.equal(fs.existsSync(path.join(unpacked,'resources/setup')),false);
    assert.equal(fs.readFileSync(path.join(unpacked,'resources/powerpoint/Control.ps1')).subarray(0,3).toString('hex'),'efbbbf');
    for(const [name,flags] of Object.entries(LAUNCHERS)){
      const expected=Buffer.from(launcherText(flags),'ascii');
      assert.deepEqual(fs.readFileSync(path.join(output,name)),expected,name+' artifact launcher');
      assert.deepEqual(fs.readFileSync(path.join(unpacked,name)),expected,name+' portable launcher');
    }
    const executable=path.join(unpacked,'CastLink PPTX Test.exe');assert.equal(fs.readFileSync(executable).subarray(0,2).toString(),'MZ');
    for(const line of fs.readFileSync(path.join(output,'SHA256SUMS'),'utf8').trim().split('\n')){
      const [sha,name]=line.split('  ');assert.equal(digest(fs.readFileSync(path.join(output,name))),sha,name);
    }
    return{output,filesVerified:inventory.length,sourceSnapshotSha256:info.sourceSnapshotSha256,executable,result:'PASS',launched:false};
  }finally{archive.close();}
}
module.exports={verify};
if(require.main===module){try{if(!process.argv[2])throw Error('Explicit private artifact directory required');console.log(JSON.stringify(verify(process.argv[2])));}catch(error){console.error(error.message);process.exitCode=1;}}
