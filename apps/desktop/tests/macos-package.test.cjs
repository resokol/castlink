'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const helpers=path.resolve(__dirname,'../scripts/macos-package-files.cjs');
function api(){assert.ok(fs.existsSync(helpers),'macOS packaging implementation must exist');return require(helpers);}
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-macos-package-test-'));
  const files={
    'LICENSE':'license','THIRD_PARTY_NOTICES':'notices',
    'apps/desktop/package.json':JSON.stringify({name:'@castlink/desktop',main:'src/main.cjs',devDependencies:{electron:'44.9.0'}}),
    'apps/desktop/src/main.cjs':'runtime','apps/desktop/src/macos-platform.cjs':'permissions','apps/desktop/src/macos-update.cjs':'updates',
    'apps/desktop/ui/start.html':'launcher','apps/desktop/assets/castlink-icon.svg':'icon',
    'apps/desktop/resources/process-audio/CastLink.ProcessAudio.exe':'Windows helper',
    'apps/desktop/src/helper.exe':'executable','apps/desktop/ui/start.js.map':'source map',
    'apps/desktop/.env':'secret','native/windows-powerpoint/Control.ps1':'PowerShell helper'
  };
  for(const [file,contents] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),contents);}
  fs.mkdirSync(path.join(root,'distribution'));
  fs.copyFileSync(path.resolve(__dirname,'../../../distribution/release-tracks.json'),path.join(root,'distribution/release-tracks.json'));
  return root;
}
test('macOS candidates require one explicit supported architecture',()=>{
  const {parseArguments}=api();
  assert.deepEqual(parseArguments(['--arch','arm64']),{arch:'arm64'});
  assert.deepEqual(parseArguments(['--arch','x64']),{arch:'x64'});
  for(const args of [[],['--arch'],['--arch','universal'],['--arch','ia32'],['--arch','arm64','--arch','x64'],['--arch','arm64','--publish']])assert.throws(()=>parseArguments(args),/Usage|architecture/);
});
test('native capability manifest is enabled only after the complete resource closure exists',()=>{
 const {completeMacPackage,createMacConfig}=api();assert.equal(typeof completeMacPackage,'function');
 const root=fixture(),stage=path.join(root,'stage'),resources=path.join(root,'resources');
 try{
  const info=api().stageMacPackage(root,stage,'a'.repeat(40),'arm64');
  assert.throws(()=>completeMacPackage(stage,info,resources,{}),/resource/);
  for(const file of ['process-audio/CastLink.ProcessAudio','remote-input/CastLink.RemoteInput','window-slides/CastLink.WindowSlides','powerpoint/CastLink.PowerPointIdentity','powerpoint/PowerPoint.js','setup/manifest.json','setup/python/bin/python3','setup/python/runtime-manifest.json']){
   fs.mkdirSync(path.dirname(path.join(resources,file)),{recursive:true});fs.writeFileSync(path.join(resources,file),'fixture');
  }
  const final=completeMacPackage(stage,info,resources,{version:'3.12.12',arch:'arm64'});
  assert.equal(final.nativeHelpersBundled,true);assert.equal(final.serverSetup,true);assert.equal(final.presentationAudio,'powerpoint-process-only');
  assert.equal(final.fullParity,false);assert.equal(final.runtimeValidated,false);assert.equal(final.portStatus,'awaiting-native-acceptance');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stage,'build-info.json'))),final);
  const config=createMacConfig(root,stage,path.join(root,'out'),final,'arm64',resources);
  assert.deepEqual(config.protocols.flatMap(p=>p.schemes),['castlink','castlink-remote','castlink-presenter','castlink-share']);
  assert.deepEqual(config.extraResources,[{from:resources,to:'.',filter:['**/*']}]);assert.ok(config.mac.extendInfo.NSAppleEventsUsageDescription);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('macOS staging preserves source identity and marks missing capabilities without shipping Windows resources',()=>{
  const {stageMacPackage,artifactName}=api();const root=fixture(),destination=path.join(root,'stage'),commit='a'.repeat(40);
  try{
    const info=stageMacPackage(root,destination,commit,'arm64');
    assert.equal(info.sourceCommit,commit);assert.equal(info.platform,'darwin');assert.equal(info.arch,'arm64');
    assert.equal(info.developmentCandidate,true);assert.equal(info.fullParity,false);assert.equal(info.portStatus,'incomplete');
    assert.equal(info.minimumSystemVersion,'13.0.0');assert.equal(info.runtimeValidated,false);
    assert.match(info.compatibilityNote,/unverified/i);
    for(const key of ['systemAudio','floatingSlideControls','powerPointBridge','remotePcCapture','remotePcInput','remoteControlBridge','remoteControlInputPolicy','serverSetup','browserControl','autoUpdate','signed','notarized'])assert.equal(info[key],false,key);
    assert.equal(info.updateChecks,true);assert.equal(info.manualUpdate,true);
    assert.equal(info.presentationAudio,'none');assert.equal(info.signing,'ad-hoc');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(destination,'build-info.json'))),info);
    const manifest=JSON.parse(fs.readFileSync(path.join(destination,'package.json')));assert.match(manifest.description,/macOS.*development/i);
    for(const file of ['src/main.cjs','src/macos-platform.cjs','src/macos-update.cjs','ui/start.html','assets/castlink-icon.svg'])assert.ok(fs.existsSync(path.join(destination,file)),file);
    for(const file of ['resources/process-audio/CastLink.ProcessAudio.exe','src/helper.exe','ui/start.js.map','.env','native/windows-powerpoint/Control.ps1'])assert.equal(fs.existsSync(path.join(destination,file)),false,file);
    assert.equal(artifactName(info.version,commit,'arm64'),`CastLink-Client-${info.version}-aaaaaaaaaaaa-mac-arm64-development.\${ext}`);
    assert.equal(artifactName(info.version,commit,'x64'),`CastLink-Client-${info.version}-aaaaaaaaaaaa-mac-x64-development.\${ext}`);
    assert.throws(()=>stageMacPackage(root,destination,commit,'arm64'),/empty/,'stale stage resources must never be included');
    assert.throws(()=>stageMacPackage(root,path.join(root,'other'),commit,'universal'),/architecture/);
    assert.throws(()=>stageMacPackage(root,path.join(root,'other'),'abc','x64'),/Exact source commit/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('macOS builder configuration is independent of Windows packaging and requests candidate bundles',()=>{
  const {createMacConfig}=api(),root=path.resolve(__dirname,'../../..'),stage='/tmp/castlink-stage',out='/tmp/castlink-output';
  for(const arch of ['arm64','x64']){
    const config=createMacConfig(root,stage,out,{version:'1.2.3',sourceCommit:'a'.repeat(40),electron:'44.9.0'},arch);
    assert.equal(config.extends,null);assert.equal(config.publish,null);assert.deepEqual(config.extraResources,[]);
    assert.deepEqual(config.mac.target,['dir','zip','dmg']);assert.equal(config.mac.identity,'-');assert.equal(config.mac.notarize,false);
    assert.equal(config.mac.minimumSystemVersion,'13.0.0');assert.equal(config.mac.hardenedRuntime,true);
    assert.equal(config.mac.entitlements,path.join(root,'apps/desktop/build/entitlements.mac.plist'));
    assert.equal(config.directories.app,stage);assert.equal(config.directories.output,out);
    assert.match(config.artifactName,new RegExp(`mac-${arch}-development`));
    assert.ok(config.mac.extendInfo.NSCameraUsageDescription);assert.ok(config.mac.extendInfo.NSMicrophoneUsageDescription);
    assert.equal(config.win,undefined);assert.equal(config.nsis,undefined);
    assert.deepEqual(config.protocols,[{name:'CastLink invitation',schemes:['castlink']}]);
  }
});
test('distribution artifacts use the updater contract for both architectures without claiming runtime acceptance',async()=>{
  const {stageMacPackage,createMacConfig}=api(),updates=require('../src/updates.cjs');
  const {EventEmitter}=require('node:events');
  const root=fixture(),commit='b'.repeat(40);
  try{
    for(const arch of ['arm64','x64']){
      const stage=path.join(root,arch),info=stageMacPackage(root,stage,commit,arch,{distribution:true});
      const config=createMacConfig(root,stage,path.join(root,'out'),info,arch);
      const name=config.artifactName.replace('${ext}','dmg');
      assert.equal(name,`CastLink-Client-${info.version}-${commit.slice(0,12)}-mac-${arch}.dmg`);
      assert.equal(info.developmentCandidate,false);assert.equal(info.fullParity,false);assert.equal(info.runtimeValidated,false);
      assert.equal(config.productName,'CastLink Client');
      assert.equal(JSON.parse(fs.readFileSync(path.join(stage,'package.json'))).description,'CastLink macOS client');
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stage,'build-info.json'))),info);
      const tag=`client-v${info.version}-${commit.slice(0,12)}`;
      const release={tag_name:tag,published_at:'2026-11-02T00:00:00Z',assets:[name,'SHA256SUMS'].map(name=>({name,state:'uploaded',size:128,browser_download_url:`https://github.com/resokol/castlink-releases/releases/download/${tag}/${name}`}))};
      const selected=updates.selectUpdate([release],{track:'client',version:'0.0.0'},{platform:'darwin',arch});
      assert.equal(selected?.installer.name,name,'the packaged artifact must be selectable by the actual updater');
      const file=path.join(root,name);fs.writeFileSync(file,'verified DMG fixture');
      const result=await updates.launchInstaller(file,{platform:'darwin',arch,spawn:(command,args)=>{
        assert.equal(command,'/usr/bin/open');assert.deepEqual(args,[file]);
        const child=new EventEmitter();queueMicrotask(()=>child.emit('close',0));return child;
      }});
      assert.deepEqual(result,{started:true,installed:false});
    }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('source provenance comes from a clean exact Git commit, including untracked changes',()=>{
  const {readSourceCommit}=api(),root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-macos-git-test-'));
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  try{
    git('init','-q');fs.writeFileSync(path.join(root,'source'),'committed');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture');
    const commit=git('rev-parse','HEAD');assert.equal(readSourceCommit(root),commit);
    fs.writeFileSync(path.join(root,'source'),'dirty');assert.throws(()=>readSourceCommit(root),/clean|Commit/);
    git('checkout','--','source');fs.writeFileSync(path.join(root,'untracked'),'dirty');assert.throws(()=>readSourceCommit(root),/clean|Commit/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('CLI refuses non-macOS hosts before loading electron-builder',()=>{
  if(process.platform==='darwin')return;
  const result=require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/package-macos.cjs'),'--arch','arm64'],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/Build the macOS client on macOS/);
});

test('macOS packaging runs natively for each target architecture',()=>{
  const {validateBuildHost}=api();
  assert.equal(typeof validateBuildHost,'function','native host validation must exist');
  for(const arch of ['arm64','x64'])assert.doesNotThrow(()=>validateBuildHost('darwin',arch,arch));
  assert.throws(()=>validateBuildHost('darwin','arm64','x64'),/native.*x64/);
  assert.throws(()=>validateBuildHost('darwin','x64','arm64'),/native.*arm64/);
  assert.throws(()=>validateBuildHost('linux','arm64','arm64'),/Build the macOS client on macOS/);
});

test('pinned builder loads an isolated macOS config without Windows YAML defaults',async()=>{
  const root=path.resolve(__dirname,'../../..'),desktop=path.join(root,'apps/desktop');
  const {createMacConfig,createMacBuildOptions}=api(),work=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-macos-builder-test-'));
  const folder=fs.readdirSync(path.join(root,'node_modules/.pnpm')).find(name=>name.startsWith('app-builder-lib@26.15.3_'));
  assert.ok(folder,'pinned builder must be installed');
  const {getConfig,validateConfiguration}=require(path.join(root,'node_modules/.pnpm',folder,'node_modules/app-builder-lib/out/util/config/config.js'));
  try{
    const config=createMacConfig(root,path.join(work,'app'),path.join(work,'output'),{version:'1.2.3',sourceCommit:'a'.repeat(40),electron:'44.9.0'},'arm64');
    const options=typeof createMacBuildOptions==='function'?createMacBuildOptions(desktop,work,config):{projectDir:desktop,config};
    const effective=await getConfig(desktop,typeof options.config==='string'?options.config:null,typeof options.config==='string'?null:options.config);
    assert.equal(effective.win,undefined,'Windows YAML must not be merged into the macOS candidate');
    assert.equal(effective.nsis,undefined);assert.deepEqual(effective.protocols.flatMap(protocol=>protocol.schemes),['castlink']);
    assert.equal(typeof options.config,'string');
    assert.deepEqual(fs.readdirSync(effective.directories.buildResources),[]);
    await validateConfiguration(effective);
  }finally{fs.rmSync(work,{recursive:true,force:true});}
});
