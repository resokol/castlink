'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {SETUP_SOURCE_FILES,stageSetupResources}=require('../scripts/setup-resources.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('setup resources include their exact helper closure and audited staged bytes',t=>{
  const root=path.resolve(__dirname,'../../..'),destination=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-setup-resources-'));
  t.after(()=>fs.rmSync(destination,{recursive:true,force:true}));
  const result=stageSetupResources(root,destination,'a'.repeat(40));
  assert.equal(result.directory,path.join(destination,'setup'));
  const manifest=JSON.parse(fs.readFileSync(path.join(result.directory,'manifest.json'),'utf8'));
  assert.equal(manifest.sourceCommit,'a'.repeat(40));assert.equal(manifest.schemaVersion,1);
  const expected=[...SETUP_SOURCE_FILES,'payload/release.json'].sort();assert.deepEqual(Object.keys(manifest.files).sort(),expected);
  for(const relative of expected){
    const staged=fs.readFileSync(path.join(result.directory,relative)),entry=manifest.files[relative];
    assert.equal(entry.sha256,hash(staged));assert.equal(entry.size,staged.length);
    if(SETUP_SOURCE_FILES.includes(relative))assert.equal(entry.sourceSha256,hash(fs.readFileSync(path.join(root,relative))));
    if(relative.endsWith('.ps1')){assert.equal(staged.subarray(0,3).toString('hex'),'efbbbf');assert.equal(/(^|[^\r])\n/.test(staged.toString('utf8')),false,relative);}
  }
  for(const relative of ['scripts/simple-easy-setup-gui.ps1','scripts/windows-simple-easy-setup.ps1','scripts/simple-easy-setup-window.xaml','scripts/simple-easy-setup-control.ico','scripts/simple-easy-setup-release.json','scripts/ubuntu-easy-setup-bootstrap.sh','scripts/server-ssh-authorize-key.py'])assert.ok(expected.includes(relative),relative);
  for(const forbidden of ['payload/images.tar.gz','.env','EasySetup.exe','apps/web/app/page.tsx','node_modules'])assert.equal(fs.existsSync(path.join(result.directory,forbidden)),false,forbidden);
  const metadata=JSON.parse(fs.readFileSync(path.join(result.directory,'payload/release.json'),'utf8'));
  assert.equal(metadata.commit,'a'.repeat(40));assert.equal(metadata.version,JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);
  assert.equal(metadata.imageArchive,undefined,'bootstrap metadata must not claim a verified server payload');
});
test('resource staging rejects invalid provenance and links in the source closure',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-setup-input-')),dest=path.join(root,'out');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  assert.throws(()=>stageSetupResources(root,dest,'HEAD'),/Exact source commit/);
  fs.writeFileSync(path.join(root,'package.json'),'{}');
  for(const relative of SETUP_SOURCE_FILES){const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'fixture');}
  const linked=path.join(root,SETUP_SOURCE_FILES[0]);fs.unlinkSync(linked);fs.symlinkSync(path.join(root,'package.json'),linked);
  assert.throws(()=>stageSetupResources(root,dest,'a'.repeat(40)),/regular file/);
});
test('GUI forwards the menu action into the existing backend and its downloaded continuation',()=>{
  const root=path.resolve(__dirname,'../../..'),gui=fs.readFileSync(path.join(root,'scripts/simple-easy-setup-gui.ps1'),'utf8'),entry=fs.readFileSync(path.join(root,'scripts/windows-simple-easy-setup.ps1'),'utf8');
  assert.match(gui,/\[ValidateSet\('choose','install','update','remove'\)\]\[string\]\$Action='choose'/);
  assert.match(gui,/\$options=@\{Action=\$Action\}/);
  assert.match(entry,/\$forward=@\{Action=\$Action;Target=\$Target;/);
  assert.match(entry,/& \$entry @forward/);
});

test('bundled wizard stages its network configuration helper for advanced setup',t=>{
  const root=path.resolve(__dirname,'../../..'),destination=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-network-closure-'));
  t.after(()=>fs.rmSync(destination,{recursive:true,force:true}));
  const {directory}=stageSetupResources(root,destination,'b'.repeat(40));
  const entry=fs.readFileSync(path.join(directory,'scripts/windows-simple-easy-setup.ps1'),'utf8');
  assert.match(entry,/simple-easy-setup-network\.ps1/);
  const helper=path.join(directory,'scripts/simple-easy-setup-network.ps1');
  assert.equal(fs.existsSync(helper),true,'the packaged entry must have its actual network helper');
  const text=fs.readFileSync(helper,'utf8');
  assert.match(text,/function Get-SimpleNetworkConfiguration/);
  assert.match(text,/function Get-SimpleHomeUrl/);
  assert.match(fs.readFileSync(path.join(directory,'scripts/simple-easy-setup-gui.ps1'),'utf8'),/\$options=@\{Action=\$Action\}/);
});
