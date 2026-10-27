'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const updates=require('../src/updates.cjs');
const hash='a'.repeat(12),later='b'.repeat(12);
function release(track,version,commit,date='2026-10-21T00:00:00Z'){
  const tag=`${track}-v${version}-${commit}`,name=`CastLink-Client-${version}-${commit}-setup.exe`;
  return {tag_name:tag,published_at:date,draft:false,prerelease:version.includes('-'),assets:(track==='client'?[name,'SHA256SUMS']:['CastLink-Windows.zip','CastLink-Linux.tar.gz','CastLink-Provisioning.json','manifest.json','SHA256SUMS','CastLink-ThirdParty-Sources.tar.gz','CastLink-ThirdParty-Office-Sources.tar.gz']).map(name=>({name,state:'uploaded',size:128,browser_download_url:`https://github.com/resokol/castlink-releases/releases/download/${tag}/${name}`}))};
}
function temporary(){return fs.mkdtempSync(path.join(os.tmpdir(),'castlink-updates-test-'));}
test('channel selection orders semantic versions and same-version builds by known public release time',()=>{
  const current={track:'client',version:'1.0.0-rc.8',sourceCommit:hash+'a'.repeat(28)};
  const old=release('client',current.version,hash,'2026-10-20T00:00:00Z'),next=release('client',current.version,later);
  assert.equal(updates.selectUpdate([release('server-setup','9.0.0',later),next,old],current).tag,next.tag_name);
  assert.equal(updates.selectUpdate([next],current),null,'unknown same-version commit must not be downgraded');
  assert.equal(updates.selectUpdate([old,next],{...current,sourceCommit:later+'b'.repeat(28)}),null);
  assert.equal(updates.selectUpdate([release('client','1.0.0-rc.9',later),old],current).version,'1.0.0-rc.9');
  assert.equal(updates.selectUpdate([release('client','1.0.0-rc.7',later),{...next,draft:true}],current),null);
  assert.ok(updates.compareVersions('1.0.0-rc.10','1.0.0-rc.9')>0);assert.ok(updates.compareVersions('1.0.0','1.0.0-rc.10')>0);
});
test('repository rename accepts only exact legacy or canonical asset paths in both channels',()=>{
  for(const track of ['client','server-setup']) for(const repository of ['castlink-releases','castlink']){
    const item=release(track,'1.0.1',later);
    for(const asset of item.assets)asset.browser_download_url=asset.browser_download_url.replace('/castlink-releases/','/'+repository+'/');
    const current={track,version:'1.0.0'};
    const selected=updates.selectUpdate([item],current);
    assert.equal(selected?.tag,item.tag_name,'renamed public repository remains the same update channel');
    if(track==='client')assert.equal(selected.installer.url,item.assets[0].browser_download_url);
    const correct=item.assets[0].browser_download_url;
    for(const invalid of [correct.replace('/resokol/','/other/'),correct.replace('/'+repository+'/','/studiolink/'),correct+'?download=1',correct+'#file',correct.replace(item.tag_name,'other-tag'),correct.replace('/releases/download/','/releases/download/../'),correct.replace('https://github.com/','https://github.com.evil.example/'),correct.replace('https://github.com/','https://user@github.com/')]){
      item.assets[0].browser_download_url=invalid;
      assert.equal(updates.selectUpdate([item],current),null,'only exact tag/name in the two known aliases is accepted: '+invalid);
    }
  }
});
test('checksum matching is exact and duplicate, traversal or cross-release assets are refused',()=>{
  const item=updates.selectUpdate([release('client','1.0.1',later)],{track:'client',version:'1.0.0',sourceCommit:hash});
  const name=item.installer.name,sum='c'.repeat(64);
  assert.equal(updates.parseChecksum(`${sum}  ${name}\n`,name),sum);
  for(const text of [`${sum}  ../${name}`,`${sum}  ${name}\n${sum}  ${name}`,`bad  ${name}`])assert.throws(()=>updates.parseChecksum(text,name));
  const wrong=release('client','1.0.1',later);wrong.assets[0].browser_download_url='https://example.com/setup.exe';
  assert.equal(updates.selectUpdate([wrong],{track:'client',version:'1.0.0'}),null);
});
test('disabled automatic check performs no request; manual check remains available and settings survive restart',async()=>{
  const directory=temporary();try{
    let requests=0;const show=[];
    const options={userData:directory,current:{track:'client',version:'1.0.0'},fetchReleases:async()=>{requests++;return[];},showMessage:async value=>{show.push(value);return {response:0,checkboxChecked:true};}};
    const controller=updates.createUpdateController(options);controller.setAutomatic(false);
    await controller.check();assert.equal(requests,0);
    const restarted=updates.createUpdateController(options);assert.equal(restarted.automatic(),false);
    await restarted.check({manual:true});assert.equal(requests,1);assert.equal(show.length,1);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('declining notification persists checkbox but never downloads, installs or quits',async()=>{
  const directory=temporary();try{
    let downloads=0,installs=0;const shown=[];
    const controller=updates.createUpdateController({userData:directory,current:{track:'client',version:'1.0.0'},fetchReleases:async()=>[release('client','1.0.1',later)],showMessage:async value=>{shown.push(value);return {response:0,checkboxChecked:true};},download:async()=>{downloads++;},install:async()=>{installs++;}});
    await controller.check();assert.equal(downloads,0);assert.equal(installs,0);assert.equal(controller.automatic(),false);assert.equal(shown.length,1);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('explicit update downloads verified installer and requires separate close/restart consent',async()=>{
  const directory=temporary();try{
    const events=[],answers=[1,0];
    const controller=updates.createUpdateController({userData:directory,current:{track:'client',version:'1.0.0'},fetchReleases:async()=>[release('client','1.0.1',later)],showMessage:async()=>({response:answers.shift(),checkboxChecked:false}),download:async()=>{events.push('download');return {file:'verified.exe',cleanup:()=>events.push('cleanup')};},install:async()=>events.push('install')});
    await controller.check();assert.deepEqual(events,['download','cleanup']);
    answers.push(1,1);await controller.check({manual:true});assert.deepEqual(events,['download','cleanup','download','install']);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('actual download streams bytes, checks SHA256 and removes corrupt files before installer launch',async()=>{
  const directory=temporary();try{
    const item=updates.selectUpdate([release('client','1.0.1',later)],{track:'client',version:'1.0.0'}),bytes=Buffer.from('test installer bytes');
    let corrupt=false;const fetch=async url=>new Response(url.endsWith('SHA256SUMS')?`${corrupt?'0'.repeat(64):crypto.createHash('sha256').update(bytes).digest('hex')}  ${item.installer.name}\n`:bytes);
    const result=await updates.downloadInstaller(item,{directory,fetch});assert.deepEqual(fs.readFileSync(result.file),bytes);result.cleanup();assert.deepEqual(fs.readdirSync(directory),[]);
    corrupt=true;await assert.rejects(updates.downloadInstaller(item,{directory,fetch}),/checksum/i);assert.deepEqual(fs.readdirSync(directory),[]);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('server discovery requires completed owned installation and matching compose commit; ordinary saved origin is irrelevant',()=>{
  const directory=temporary();try{
    const folder=path.join(directory,'server'),id='24d9077a-e9dd-47d5-a85d-b0c6d99bb5c4',commit='a'.repeat(40);fs.mkdirSync(folder);
    fs.writeFileSync(path.join(directory,'.castlink-runtime.json'),JSON.stringify({schemaVersion:1,installations:[{folder,installationId:id}]}));
    const state={schemaVersion:1,completed:true,target:'local',installationId:id,version:'1.0.0-rc.8',commit,password:'must not escape'};
    fs.writeFileSync(path.join(folder,'.castlink-install.json'),JSON.stringify(state));fs.writeFileSync(path.join(folder,'.castlink-owned.json'),JSON.stringify({schemaVersion:1,installationId:id,folder}));fs.writeFileSync(path.join(folder,'compose.json'),JSON.stringify({services:{web:{image:'castlink-easy-web:'+commit}}}));
    const known=updates.readServerBuilds([directory]);assert.equal(known.length,1);assert.equal(known[0].sourceCommit,commit);assert.equal(JSON.stringify(known).includes('must not escape'),false);
    fs.writeFileSync(path.join(folder,'compose.json'),JSON.stringify({services:{web:{image:'castlink-easy-web:'+'b'.repeat(40)}}}));assert.equal(updates.readServerBuilds([directory]).length,0);
    fs.writeFileSync(path.join(folder,'.castlink-install.json'),JSON.stringify({...state,completed:false}));assert.equal(updates.readServerBuilds([directory]).length,0);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('installer handoff uses fixed executable arguments and closes the app only after successful spawn',async()=>{
  const directory=temporary();try{
    const file=path.join(directory,'client-setup.exe');fs.writeFileSync(file,'verified fixture');let closed=0,child;
    const spawn=(...args)=>{assert.equal(args[0],file);assert.deepEqual(args[1],[]);assert.equal(args[2].shell,false);child=new(require('node:events').EventEmitter)();child.unref=()=>{};return child;};
    const started=updates.launchInstaller(file,{platform:'win32',spawn,onStarted:()=>closed++});assert.equal(closed,0);child.emit('spawn');await started;assert.equal(closed,1);
    const failed=updates.launchInstaller(file,{platform:'win32',spawn,onStarted:()=>closed++});child.emit('error',Error('launch refused'));await assert.rejects(failed);assert.equal(closed,1);
    await assert.rejects(updates.launchInstaller(file,{platform:'linux',spawn,onStarted:()=>closed++}));
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('explicit download failure from automatic notification is reported without install or quit',async()=>{
  const directory=temporary();try{const prompts=[];let installed=false;
    const controller=updates.createUpdateController({userData:directory,current:{track:'client',version:'1.0.0'},fetchReleases:async()=>[release('client','1.0.1',later)],showMessage:async options=>{prompts.push(options);return {response:1};},download:async()=>{throw Error('network secret');},install:async()=>installed=true});
    await controller.check();assert.equal(prompts.length,2);assert.equal(prompts[1].type,'warning');assert.equal(installed,false);assert.ok(!JSON.stringify(prompts).includes('network secret'));
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('server release has separate consent and launches its own wizard without client download',async()=>{
  const directory=temporary();try{const events=[];
    const controller=updates.createUpdateController({userData:directory,current:{track:'client',version:'1.0.0'},getServers:()=>[{track:'server-setup',version:'1.0.0',folder:'known-installation'}],fetchReleases:async()=>[release('server-setup','1.0.1',later)],showMessage:async options=>{events.push(options.message);return {response:1};},download:async()=>assert.fail('client download must not run'),updateServer:async()=>events.push('wizard')});
    await controller.check();assert.equal(events.length,2);assert.equal(events[1],'wizard');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('managed remote discovery reads only saved ownership and current HTTPS build, skips unreachable or unowned origins',async()=>{
  const directory=temporary();try{
    const folder=path.join(directory,'Remote','203.0.113.9-22'),id='24d9077a-e9dd-47d5-a85d-b0c6d99bb5c4';fs.mkdirSync(folder,{recursive:true});
    const state={schemaVersion:1,installationId:id,target:'remote',completed:true,address:'managed.example',publicHttps:true,password:'never-send'};
    fs.writeFileSync(path.join(folder,'.castlink-install.json'),JSON.stringify(state));fs.writeFileSync(path.join(folder,'.castlink-owned.json'),JSON.stringify({schemaVersion:1,folder,installationId:id}));
    const index=path.join(directory,'managed.json');fs.writeFileSync(index,JSON.stringify({schemaVersion:1,installations:[{folder,installationId:id}]}));
    const requests=[];const fetch=async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({productVersion:'1.0.0-rc.8',buildId:'1.0.0-rc.8-'+hash}));};
    const known=await updates.discoverServerBuilds({roots:[directory],indexPath:index,fetch});assert.equal(known.length,1);assert.equal(known[0].sourceCommit,hash);assert.equal(known[0].origin,'https://managed.example');assert.equal(requests.length,1);assert.equal(requests[0].url,'https://managed.example/api/version');assert.equal(requests[0].options.redirect,'error');assert.ok(!JSON.stringify(requests).includes('never-send'));
    const fallback=await updates.discoverServerBuilds({roots:[directory],fetch});assert.equal(fallback.length,1,'default Remote mirror predates the managed index');
    assert.equal((await updates.discoverServerBuilds({roots:[directory],fetch:async()=>{throw Error('offline');}})).length,0);
    fs.writeFileSync(path.join(folder,'.castlink-owned.json'),JSON.stringify({schemaVersion:1,folder,installationId:'other'}));assert.equal((await updates.discoverServerBuilds({roots:[directory],indexPath:index,fetch})).length,0);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('incomplete, duplicate, unuploaded and unbounded releases fall back to a complete candidate in each channel',()=>{
  for(const track of ['client','server-setup']){
    const current={track,version:'1.0.0'},good=release(track,'1.0.1',hash);
    for(const mutate of [r=>r.assets.pop(),r=>r.assets[0].state='new',r=>r.assets[0].size=0,r=>r.assets[0].size=Number.MAX_SAFE_INTEGER,r=>r.assets.push({...r.assets[0]})]){
      const incomplete=release(track,'1.0.2',later);mutate(incomplete);assert.equal(updates.selectUpdate([incomplete,good],current).tag,good.tag_name);
    }
  }
});
test('next launch cleanup removes only owned downloaded installer directories and preserves other files',()=>{
  const directory=temporary();try{
    const own=path.join(directory,'castlink-client-update-aB1234');fs.mkdirSync(own);fs.writeFileSync(path.join(own,'CastLink-Client-1.0.1-aaaaaaaaaaaa-setup.exe'),'old installer');
    const other=path.join(directory,'unrelated');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'keep.txt'),'keep');
    updates.cleanupDownloads(directory);assert.equal(fs.existsSync(own),false);assert.equal(fs.readFileSync(path.join(other,'keep.txt'),'utf8'),'keep');
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('release discovery requests the canonical API directly',async()=>{
 const urls=[];
 assert.deepEqual(await updates.fetchReleases({fetch:async url=>{urls.push(url);return new Response('[]');}}),[]);
 assert.deepEqual(urls,['https://api.github.com/repos/resokol/castlink/releases?per_page=100&page=1']);
});

test('RC9 discovers complete stable 1.0.0 in each desktop channel and refuses incomplete stable releases',()=>{
 for(const track of ['client','server-setup']){
  const current={track,version:'1.0.0-rc.9',sourceCommit:hash+'a'.repeat(28)};
  const rc=release(track,current.version,hash),stable=release(track,'1.0.0',later);
  for(const asset of stable.assets)asset.browser_download_url=asset.browser_download_url.replace('/castlink-releases/','/castlink/');
  const partial=release(track,'1.0.1',later);partial.assets.pop();
  const malformed=release(track,'1.0',later);
  assert.equal(updates.selectUpdate([rc,partial,malformed,stable],current)?.tag,stable.tag_name);
  assert.equal(updates.selectUpdate([rc,partial,malformed],current),null);
 }
});
