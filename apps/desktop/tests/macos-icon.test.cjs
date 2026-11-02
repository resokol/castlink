'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {CASTLINK_ICON_SOURCE,ICNS_ENTRIES,stageMacIcon,validateIcns,verifyMacBundleIcon}=require('../scripts/macos-icon.cjs');
const repository=path.resolve(__dirname,'../../..'),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function iconBytes(){
 const chunks=[];
 for(const [type,size]of Object.entries(ICNS_ENTRIES)){
  const png=Buffer.alloc(58);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(size,16);png.writeUInt32BE(size,20);png[24]=8;png[25]=6;png.writeUInt32BE(1,33);png.write('IDAT',37);png.write('IEND',50);
  const header=Buffer.alloc(8);header.write(type);header.writeUInt32BE(8+png.length,4);chunks.push(header,png);
 }
 const body=Buffer.concat(chunks),header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(body.length+8,4);return Buffer.concat([header,body]);
}
function directory(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-icon-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function converter(calls){return async options=>{calls.push(options);const file=path.join(options.outDir,'icon.icns');fs.writeFileSync(file,iconBytes());return {isFallback:false,icons:[{file,size:1024}]};};}
test('stages the existing SVG through the pinned builder pipeline without fallback and records identity',async t=>{
 const destination=path.join(directory(t),'icon'),calls=[],icon=await stageMacIcon({root:repository,destination,convertIcon:converter(calls)});
 assert.equal(icon,path.join(destination,'castlink-icon.icns'));assert.equal(calls.length,1);
 assert.deepEqual(calls[0].sources,[path.join(repository,CASTLINK_ICON_SOURCE)]);assert.deepEqual(calls[0].fallbackSources,[]);assert.deepEqual(calls[0].roots,[]);assert.equal(calls[0].format,'icns');
 assert.deepEqual(validateIcns(fs.readFileSync(icon)),[16,32,64,128,256,512,1024]);
 const manifest=JSON.parse(fs.readFileSync(path.join(destination,'castlink-icon.json')));
 assert.equal(manifest.sourceSha256,hash(fs.readFileSync(path.join(repository,CASTLINK_ICON_SOURCE))));assert.equal(manifest.sha256,hash(fs.readFileSync(icon)));assert.equal(manifest.converter,'electron-builder@26.15.3/icons@1.1.0');
 assert.deepEqual(fs.readdirSync(destination).sort(),['castlink-icon.icns','castlink-icon.json']);
 await assert.rejects(stageMacIcon({root:repository,destination,convertIcon:converter(calls)}),/empty/);
});
test('fails closed on builder fallback, undersized output and corrupt ICNS',async t=>{
 for(const change of ['fallback','size','corrupt']){
  const destination=path.join(directory(t),change);
  await assert.rejects(stageMacIcon({root:repository,destination,convertIcon:async options=>{
   const file=path.join(options.outDir,'icon.icns');fs.writeFileSync(file,change==='corrupt'?Buffer.from('not an icon'):iconBytes());return {isFallback:change==='fallback',icons:[{file,size:change==='size'?256:1024}]};
  }}),/fell back|resolution|ICNS/);
  assert.deepEqual(fs.readdirSync(destination),[]);
 }
});
test('rejects truncated icons, absent Retina entries and wrong PNG dimensions',()=>{
 const bytes=iconBytes();assert.throws(()=>validateIcns(bytes.subarray(0,bytes.length-1)),/header/);
 const missing=bytes.subarray(0,bytes.length-66);missing.writeUInt32BE(missing.length,4);assert.throws(()=>validateIcns(missing),/Retina/);
 const wrong=iconBytes();wrong.writeUInt32BE(17,32);assert.throws(()=>validateIcns(wrong),/dimensions/);
});
test('final bundle verification requires Info.plist reference and matching CastLink source/artifact hashes',async t=>{
 const root=directory(t),staged=await stageMacIcon({root:repository,destination:path.join(root,'icon'),convertIcon:converter([])}),bundle=path.join(root,'CastLink.app'),resources=path.join(bundle,'Contents/Resources');
 fs.mkdirSync(resources,{recursive:true});fs.writeFileSync(path.join(bundle,'Contents/Info.plist'),'plist');
 fs.copyFileSync(staged,path.join(resources,'icon.icns'));fs.copyFileSync(path.join(root,'icon/castlink-icon.json'),path.join(resources,'castlink-icon.json'));
 const calls=[],run=(file,args,options)=>{calls.push({file,args,options});return 'icon.icns\n';};
 assert.equal((await verifyMacBundleIcon({bundle,run})).status,'PASS');assert.equal(calls[0].file,'/usr/libexec/PlistBuddy');assert.deepEqual(calls[0].args,['-c','Print :CFBundleIconFile',path.join(bundle,'Contents/Info.plist')]);
 assert.equal(calls[0].options.timeout,5000);assert.equal(calls[0].options.killSignal,'SIGKILL');
 await assert.rejects(verifyMacBundleIcon({bundle,run:()=> 'electron.icns'}),/configured/);
 const manifest=JSON.parse(fs.readFileSync(path.join(resources,'castlink-icon.json')));manifest.sourceSha256='a'.repeat(64);fs.writeFileSync(path.join(resources,'castlink-icon.json'),JSON.stringify(manifest));
 await assert.rejects(verifyMacBundleIcon({bundle,run}),/provenance/);
});
