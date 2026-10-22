'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const script=path.resolve(__dirname,'../scripts/package-pptx-test.cjs');
const api=fs.existsSync(script)?require(script):{};
test('private package stages exact runtime snapshot with test identity and current native helper, without installer resources',()=>{
  assert.equal(typeof api.stagePrivatePackage,'function');
  const destination=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-private-stage-')),root=path.resolve(__dirname,'../../..');
  try{
    const info=api.stagePrivatePackage(root,destination,'a'.repeat(40));
    assert.equal(info.testBuild,true);assert.equal(info.track,'pptx-private-test');assert.equal(info.updateChecks,false);assert.equal(info.serverSetup,false);
    assert.equal(info.sourceCommit,'a'.repeat(40));assert.equal(info.sourceDirty,true);assert.match(info.sourceSnapshotSha256,/^[a-f0-9]{64}$/);
    const manifest=JSON.parse(fs.readFileSync(path.join(destination,'package.json')));assert.equal(manifest.name,'castlink-pptx-private-test');assert.match(manifest.version,/pptx-test/);
    assert.equal(fs.readFileSync(path.join(destination,'src/main.cjs'),'utf8'),fs.readFileSync(path.join(root,'apps/desktop/src/main.cjs'),'utf8'));
    for(const file of ['src/presentation-helper.cjs','src/helper-preload.cjs','ui/presentation-helper.html','ui/presentation-helper.js','ui/presentation-helper.css'])assert.ok(fs.existsSync(path.join(destination,file)),file);
    assert.deepEqual(fs.readFileSync(path.join(destination,'native-resources/powerpoint/Control.ps1')),fs.readFileSync(path.join(root,'native/windows-powerpoint/Control.ps1')));
    assert.equal(fs.existsSync(path.join(destination,'native-resources/setup')),false);
    const inventory=JSON.parse(fs.readFileSync(path.join(destination,'snapshot-files.json')));
    const main=inventory.find(x=>x.file==='src/main.cjs');assert.equal(main.sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(destination,main.file))).digest('hex'));
    assert.equal(inventory.some(x=>/\.env|node_modules|tests\//.test(x.file)),false);
  }finally{fs.rmSync(destination,{recursive:true,force:true});}
});
test('private builder config explicitly has separate identity, no protocols and no installer/publish targets',()=>{
  assert.equal(typeof api.privateBuilderConfig,'function');
  const config=api.privateBuilderConfig({stage:'stage',output:'output',electron:'44.9.0'});
  assert.equal(config.appId,'ru.castlink.pptx-test');assert.equal(config.productName,'CastLink PPTX Test');
  assert.deepEqual(config.protocols,[]);assert.equal(config.publish,null);assert.equal(config.extends,null);
  assert.deepEqual(config.win.target,['dir','zip']);assert.equal(config.nsis,undefined);
  assert.ok(config.extraResources.some(x=>x.to==='powerpoint'));
});
