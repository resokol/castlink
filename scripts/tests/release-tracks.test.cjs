'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {TRACKS,readManifest,resolveTrack,setVersion,assertSource}=require('../release-track.cjs');
const {releaseFiles,verifyFiles,verifyUploaded}=require('../publish-release-track.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('products keep independent versions and tags while releases use main',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-tracks-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const baseline=readManifest();assert.equal(baseline.repository,'resokol/castlink');
  fs.mkdirSync(path.join(root,'distribution'));fs.writeFileSync(path.join(root,'distribution/release-tracks.json'),JSON.stringify(baseline));
  setVersion('client','2.3.4',root);
  assert.equal(resolveTrack('client','a'.repeat(40),root).version,'2.3.4');
  for(const track of ['server-setup','linux'])assert.equal(resolveTrack(track,'a'.repeat(40),root).version,baseline.tracks[track].version);
  for(const track of TRACKS){
    const info=resolveTrack(track,'b'.repeat(40),root);
    assert.equal(info.tag,`${track}-v${info.version}-bbbbbbbbbbbb`);assert.equal(info.buildNumber,`${info.version}-bbbbbbbbbbbb`);
    assert.doesNotThrow(()=>assertSource(info,'refs/heads/main'));assert.equal(info.branch,'main');assert.throws(()=>assertSource(info,`refs/heads/release/${track}`));
    assert.throws(()=>assertSource(info,'refs/heads/fix/unreviewed'));assert.throws(()=>assertSource(info,'refs/tags/'+info.tag));
  }
  assert.throws(()=>resolveTrack('all','a'.repeat(40),root));assert.throws(()=>resolveTrack('linux','main',root));
  for(const value of ['1.0','1.0.0-01','01.0.0','1.0.0\n','1.0.0+metadata','1.0.0-rc_9'])assert.throws(()=>setVersion('client',value,root));
});
test('publication requires exactly this track, full source SHA and every real file checksum',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-publish-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const track of TRACKS){
    const directory=path.join(root,track);fs.mkdirSync(directory);const info=resolveTrack(track,'a'.repeat(40));
    for(const name of releaseFiles(info))if(name!=='SHA256SUMS')fs.writeFileSync(path.join(directory,name),name==='manifest.json'?JSON.stringify(info):`real fixture bytes: ${name}`);
    function sums(){fs.writeFileSync(path.join(directory,'SHA256SUMS'),releaseFiles(info).filter(name=>name!=='SHA256SUMS').map(name=>`${hash(fs.readFileSync(path.join(directory,name)))}  ${name}`).join('\n')+'\n');}
    sums();const files=verifyFiles(directory,info);assert.equal(files.length,releaseFiles(info).length);
    const uploaded={tag_name:info.tag,draft:true,assets:files.map(file=>({name:file.name,state:'uploaded',size:fs.statSync(file.file).size,digest:file.digest}))};
    assert.doesNotThrow(()=>verifyUploaded(uploaded,info,files));
    assert.throws(()=>verifyUploaded({...uploaded,draft:false},info,files),/draft/);
    assert.throws(()=>verifyUploaded({...uploaded,assets:uploaded.assets.slice(1)},info,files),/assets/);
    const bad=structuredClone(uploaded);bad.assets[0].digest='sha256:'+'0'.repeat(64);assert.throws(()=>verifyUploaded(bad,info,files),/bytes/);
    fs.appendFileSync(path.join(directory,'manifest.json'),' ');assert.throws(()=>verifyFiles(directory,info),/Checksum/);
    fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify({...info,sourceCommit:'b'.repeat(40)}));sums();assert.throws(()=>verifyFiles(directory,info),/provenance/);
    if(track==='linux')assert.equal(releaseFiles(info).includes('CastLink-Windows.zip'),false);
    if(track==='server-setup')assert.ok(releaseFiles(info).includes('CastLink-Linux.tar.gz'),'setup retains an exact pinned VPS transport archive');
  }
});
test('the actual web config reports the selected release version while ordinary builds use the root version',async()=>{
  const keys=['CASTLINK_PRODUCT_VERSION','CASTLINK_PRODUCT_BUILD_NUMBER','STUDIOLINK_RELEASE'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const configUrl=pathToFileURL(path.resolve(__dirname,'../../apps/web/next.config.ts')).href;
  try{
    for(const key of keys)delete process.env[key];
    const ordinary=(await import(configUrl+'?track-test=ordinary')).default;
    const root=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../package.json'),'utf8'));
    assert.equal(ordinary.env.NEXT_PUBLIC_PRODUCT_VERSION,root.version);
    assert.equal(ordinary.env.NEXT_PUBLIC_BUILD_NUMBER,root.buildNumber);
    process.env.CASTLINK_PRODUCT_VERSION='1.0.0-rc.9';
    process.env.CASTLINK_PRODUCT_BUILD_NUMBER='1.0.0-rc.9-aaaaaaaaaaaa';
    process.env.STUDIOLINK_RELEASE='1.0.0-rc.9-aaaaaaaaaaaa';
    const selected=(await import(configUrl+'?track-test=selected')).default;
    assert.equal(selected.env.NEXT_PUBLIC_PRODUCT_VERSION,'1.0.0-rc.9');
    assert.equal(selected.env.NEXT_PUBLIC_BUILD_NUMBER,'1.0.0-rc.9-aaaaaaaaaaaa');
    assert.equal(await selected.generateBuildId(),'1.0.0-rc.9-aaaaaaaaaaaa');
  }finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
