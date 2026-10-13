import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(action){
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-easy-package-')),source=path.join(root,'source'),output=path.join(root,'ready');await mkdir(source);
 const contents={'runtime/node.exe':'fixture runtime','native-bootstrap.mjs':'fixture bootstrap','cli/main.js':'fixture main','cli/package.json':'{"type":"module"}','cli-release.json':'{"research":true}'};
 const files=[];for(const [name,data] of Object.entries(contents)){await mkdir(path.dirname(path.join(source,name)),{recursive:true});await writeFile(path.join(source,name),data);files.push({path:name,bytes:Buffer.byteLength(data),sha256:hash(data)});}
 await mkdir(path.join(source,'bin'));await writeFile(path.join(source,'bin/castlink.exe'),'fixture native');
 const inventory=path.join(root,'inventory.json');await writeFile(inventory,JSON.stringify({schemaVersion:1,target:'win32-x64',files}));
 const options={source,output,inventory,launcherSHA256:hash('fixture native'),profilesRoot:'D:\\GitHub\\SL\\studiolink\\profiles'};
 try{await action({root,options,files});}finally{await rm(root,{recursive:true,force:true});}
}
test('Easy Setup assembles the complete checked native package and a double-click console entry',()=>fixture(async({options,files})=>{
 const {packageEasySetup}=await import('../package-easy-setup.mjs');
 await packageEasySetup({...options,resumeProfile:'local-test'});
 for(const file of files)assert.equal(hash(await readFile(path.join(options.output,'app',file.path))),file.sha256);
 assert.equal(hash(await readFile(path.join(options.output,'app/bin/castlink.exe'))),options.launcherSHA256);
 const launcher=await readFile(path.join(options.output,'EasySetup.cmd'),'utf8');
 assert.match(launcher,/%~dp0EasySetup\.ps1/);assert.match(launcher,/setlocal DisableDelayedExpansion/);assert.match(launcher,/pause/);
 assert.match(launcher,/CASTLINK_PROFILE_ROOT=D:\\GitHub\\SL\\studiolink\\profiles/);
 const resume=await readFile(path.join(options.output,'Continue-local.cmd'),'utf8');assert.match(resume,/-Target local -Profile local-test/);
 const setup=await readFile(path.join(options.output,'EasySetup.ps1'),'utf8');assert.match(setup,/Docker\.DockerDesktop/);assert.match(setup,/Start-Process -FilePath \$desktop/);assert.match(setup,/Test-LinuxEngine/);assert.match(setup,/--easy-setup/);
 const prepare=await readFile(path.join(options.output,'Prepare-VPS.cmd'),'utf8');assert.match(prepare,/Prepare-VPS\.ps1/);
 const ssh=await readFile(path.join(options.output,'Prepare-VPS.ps1'),'utf8');
 assert.match(ssh,/OpenSSH\\ssh\.exe/);assert.match(ssh,/UserKnownHostsFile=/);assert.match(ssh,/StrictHostKeyChecking=ask/);assert.match(ssh,/StrictHostKeyChecking=yes/);assert.match(ssh,/BatchMode=yes/);assert.match(ssh,/id_ed25519/);
 assert.doesNotMatch(ssh,/StrictHostKeyChecking=no|authorized_keys|C:\\Users/);
 assert.match(ssh,/bash -s -- check/);assert.match(ssh,/bash -s -- install/);assert.match(ssh,/docker login ghcr.io/);
 assert.match(await readFile(path.join(options.output,'ubuntu-easy-setup-bootstrap.sh'),'utf8'),/download.docker.com/);
 await access(path.join(options.output,'README_RU.txt'));
}));
test('Easy Setup refuses changed payload bytes before creating the destination',()=>fixture(async({options})=>{
 const {packageEasySetup}=await import('../package-easy-setup.mjs');await writeFile(path.join(options.source,'cli/main.js'),'fixture evil');
 await assert.rejects(()=>packageEasySetup(options),/checksum|целостност/i);await assert.rejects(()=>access(options.output));
}));
test('Easy Setup preserves an existing destination and refuses an unbound launcher',()=>fixture(async({options})=>{
 const {packageEasySetup}=await import('../package-easy-setup.mjs');await mkdir(options.output);await writeFile(path.join(options.output,'keep.txt'),'saved');
 await assert.rejects(()=>packageEasySetup(options));assert.equal(await readFile(path.join(options.output,'keep.txt'),'utf8'),'saved');
 await assert.rejects(()=>packageEasySetup({...options,output:options.output+'-other',launcherSHA256:'0'.repeat(64)}),/checksum|целостност/i);
}));
test('Easy Setup rejects paths that would expand commands in its Windows launcher',()=>fixture(async({options})=>{
 const {packageEasySetup}=await import('../package-easy-setup.mjs');
 for(const profilesRoot of ['relative','D:\\%TEMP%\\profiles','D:\\bad"\\profiles','D:\\bad\nprofiles'])await assert.rejects(()=>packageEasySetup({...options,profilesRoot}));
 await assert.rejects(()=>packageEasySetup({...options,resumeProfile:'home & echo bad'}));
 await assert.rejects(()=>access(options.output));
}));
test('Easy Setup carries a hash-verified portable server manifest separately from the native package',()=>fixture(async({root,options})=>{
 const {packageEasySetup}=await import('../package-easy-setup.mjs');
 const image=name=>({reference:'registry.example.org/'+name+'@sha256:'+'a'.repeat(64),architectures:['amd64']});
 const manifest={schemaVersion:1,release:'1.0.0-rc.2-fixture',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,image(name)]))};
 const bytes=Buffer.from(JSON.stringify(manifest)+'\n'),file=path.join(root,'release.json');await writeFile(file,bytes);
 await packageEasySetup({...options,serverManifest:file,serverManifestSHA256:hash(bytes)});
 assert.deepEqual(await readFile(path.join(options.output,'server/release.json')),bytes);
 const metadata=JSON.parse(await readFile(path.join(options.output,'PACKAGE.json'),'utf8'));assert.equal(metadata.serverManifestSHA256,hash(bytes));
 await assert.rejects(()=>packageEasySetup({...options,output:options.output+'-wrong',serverManifest:file,serverManifestSHA256:'0'.repeat(64)}),/checksum/i);
 await assert.rejects(()=>access(options.output+'-wrong'));
}));
