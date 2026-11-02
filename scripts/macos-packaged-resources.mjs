// Final-bundle integrity and passive protocol checks. These establish artifact
// closure; they do not establish TCC grants, capture, audio isolation or input.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
const require=createRequire(import.meta.url);
const {MAC_PYTHON_RUNTIMES,PYTHON_RELEASE,validatePythonIdentity}=require('../apps/desktop/scripts/macos-python-runtime.cjs');
const {MAC_SETUP_SOURCE_FILES}=require('../apps/desktop/scripts/macos-setup-resources.cjs');
const {verifyMacBundleIcon}=require('../apps/desktop/scripts/macos-icon.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const helpers=Object.freeze({audio:'process-audio/CastLink.ProcessAudio',input:'remote-input/CastLink.RemoteInput',slides:'window-slides/CastLink.WindowSlides',powerpoint:'powerpoint/CastLink.PowerPointIdentity'});
function jsonFile(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function regular(file,{executable=false}={}){
 const stat=fs.lstatSync(file);if(!stat.isFile()||executable&&(stat.mode&0o111)===0)throw Error('Required packaged resource is not a regular '+(executable?'executable':'file')+': '+file);
 return stat;
}
function safeRelative(relative){
 if(typeof relative!=='string'||!relative||path.posix.isAbsolute(relative)||/[\\\x00-\x1f\x7f]/.test(relative)||relative.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe setup manifest path');
 return relative;
}
function verifySourceTree(setup){
 const manifest=jsonFile(path.join(setup,'manifest.json'));
 if(manifest.schemaVersion!==1||manifest.platform!=='darwin'||!/^[a-f0-9]{40}$/.test(manifest.sourceCommit)||!manifest.files||typeof manifest.files!=='object'||Array.isArray(manifest.files)||!manifest.packages||typeof manifest.packages!=='object'||Array.isArray(manifest.packages))throw Error('Invalid setup source manifest');
 for(const relative of MAC_SETUP_SOURCE_FILES)if(!Object.hasOwn(manifest.files,relative))throw Error('Setup source manifest is missing '+relative);
 for(const [relative,expected]of Object.entries(manifest.files)){
  safeRelative(relative);if(relative==='manifest.json'||relative==='python'||relative.startsWith('python/'))throw Error('Unsafe setup manifest runtime path');
  const file=path.join(setup,relative),stat=regular(file);
  if(!expected||!/^[a-f0-9]{64}$/.test(expected.sha256)||!Number.isSafeInteger(expected.size)||expected.size<0||stat.size!==expected.size||hash(fs.readFileSync(file))!==expected.sha256)throw Error('Setup source integrity mismatch: '+relative);
 }
 let count=0;
 function walk(directory,relative=''){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
   if(++count>20000)throw Error('Setup resource tree exceeds entry limit');
   const next=relative?relative+'/'+entry.name:entry.name;
   if(next==='python')continue;
   if(entry.isDirectory())walk(path.join(directory,entry.name),next);
   else if(!entry.isFile()||next!=='manifest.json'&&!Object.hasOwn(manifest.files,next))throw Error('Setup source manifest has an unlisted or symbolic resource: '+next);
   else if(/\.(node|o|a)$/.test(next))throw Error('SSH closure contains an unexpected native resource: '+next);
  }
 }
 walk(setup);
 if(!Object.hasOwn(manifest.packages,'ssh2'))throw Error('Setup manifest has no SSH dependency closure');
 for(const [name,version]of Object.entries(manifest.packages)){
  if(!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)||typeof version!=='string')throw Error('Unsafe setup manifest package');
  const relative='node_modules/'+name+'/package.json';
  if(!Object.hasOwn(manifest.files,relative))throw Error('Setup package is outside the source manifest');
  const pkg=jsonFile(path.join(setup,relative));if(pkg.name!==name||pkg.version!==version)throw Error('Setup manifest package version mismatch: '+name);
 }
 return manifest;
}
function cleanEnvironment(){
 return Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PYTHON')&&!key.startsWith('DYLD_')&&!key.startsWith('ELECTRON_')&&!['NODE_OPTIONS','NODE_PATH'].includes(key)));
}
function verifyPythonTree(directory){
 const root=fs.realpathSync(directory);let count=0;
 function walk(current){
  for(const entry of fs.readdirSync(current,{withFileTypes:true})){
   if(++count>20000)throw Error('Python resource tree exceeds entry limit');
   const file=path.join(current,entry.name);
   if(entry.isSymbolicLink()){
    const target=fs.realpathSync(file);if(target!==root&&!target.startsWith(root+path.sep))throw Error('Python resource symlink escapes the bundled runtime');
   }else if(entry.isDirectory())walk(file);
   else if(!entry.isFile())throw Error('Python runtime contains an unsupported resource');
  }
 }
 walk(directory);
}
// Run in the final app's Electron/Node runtime so that resolution and crypto
// support are proved with packaged files rather than the build machine's Node.
const closureProbe=String.raw`
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const resources=process.argv[1],arch=process.argv[2];
 const info=JSON.parse(fs.readFileSync(path.join(resources,'app.asar','build-info.json'),'utf8'));
 if(process.platform!=='darwin'||process.arch!==arch||info.platform!=='darwin'||info.arch!==arch)throw Error('Packaged Electron architecture mismatch');
 const source=JSON.parse(fs.readFileSync(path.join(resources,'setup/manifest.json'),'utf8')),packages={};
 for(const name of Object.keys(source.packages)){const pkg=require(path.join(resources,'setup/node_modules',name,'package.json'));if(pkg.name!==name)throw Error('Packaged dependency identity mismatch');packages[name]=pkg.version;}
 const {Client,utils}=require(path.join(resources,'setup/node_modules/ssh2'));
 if(typeof Client!=='function'||typeof utils?.parseKey!=='function')throw Error('SSH closure did not load');
 const transport=await import(pathToFileURL(path.join(resources,'setup/scripts/server-provisioning-ssh.mjs')).href);
 if(typeof transport.makeSshTools!=='function')throw Error('SSH transport did not load');
 const tools=transport.makeSshTools(Client,utils.parseKey);
 if(typeof tools.openVerifiedSsh!=='function'||typeof tools.executeFixedSsh!=='function')throw Error('SSH transport closure is incomplete');
 console.log(JSON.stringify({platform:process.platform,arch:process.arch,sourceCommit:info.sourceCommit,pythonRuntime:info.pythonRuntime,packages,sshLoaded:true,transportLoaded:true}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
`;
export async function verifyMacPackagedResources({bundle,arch,run=execFileSync}={}){
 if(!Object.hasOwn(MAC_PYTHON_RUNTIMES,arch))throw Error('Explicit macOS architecture required');
 if(typeof bundle!=='string'||!path.isAbsolute(bundle))throw Error('Absolute macOS app bundle required');
 if(run===execFileSync&&(process.platform!=='darwin'||process.arch!==arch))throw Error('Final bundle verification requires native macOS target architecture');
 const resources=path.join(bundle,'Contents/Resources'),macOS=path.join(bundle,'Contents/MacOS'),entries=fs.readdirSync(macOS);
 if(entries.length!==1)throw Error('Expected one packaged application executable');
 const executable=path.join(macOS,entries[0]),environment=cleanEnvironment();regular(executable,{executable:true});
 async function command(file,args,{timeout=5000,maxBuffer=65536,...options}={}){
  return String(await run(file,args,{encoding:'utf8',shell:false,timeout,maxBuffer,killSignal:'SIGKILL',env:environment,...options})).trim();
 }
 // Verify the completed Electron seal, including nested dylibs and helpers,
 // before invoking anything from the signed resource tree.
 await command('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{timeout:30000});
 await verifyMacBundleIcon({bundle,run});
 regular(path.join(resources,'app.asar'));regular(path.join(resources,'powerpoint/PowerPoint.js'));
 const source=verifySourceTree(path.join(resources,'setup'));
 const pythonDirectory=path.join(resources,'setup/python');
 if(!fs.lstatSync(pythonDirectory).isDirectory())throw Error('Python runtime directory is not a bundled directory');
 verifyPythonTree(pythonDirectory);
 const pythonManifestFile=path.join(pythonDirectory,'runtime-manifest.json');regular(pythonManifestFile);
 const python=jsonFile(pythonManifestFile),pin=MAC_PYTHON_RUNTIMES[arch];
 const expectedPython={schemaVersion:1,provider:'astral-sh/python-build-standalone',release:PYTHON_RELEASE,version:pin.version,platform:'darwin',arch,url:pin.url,sha256:pin.sha256,executable:'setup/python/bin/python3',license:'setup/python/lib/python3.12/LICENSE.txt',runtimeValidated:true};
 if(!isDeepStrictEqual(python,expectedPython))throw Error('Python runtime manifest does not match the pinned release');
 const pythonExecutable=path.join(resources,python.executable),resolvedPython=fs.realpathSync(pythonExecutable),realPythonDirectory=fs.realpathSync(pythonDirectory);
 if(!resolvedPython.startsWith(realPythonDirectory+path.sep))throw Error('Python executable symlink escapes the bundled runtime');
 regular(resolvedPython,{executable:true});
 const license=path.join(resources,python.license);if(regular(license).size<100)throw Error('Python license is missing');
 const binaries=[executable,...Object.values(helpers).map(relative=>path.join(resources,relative)),pythonExecutable];
 const target=arch==='x64'?'x86_64':'arm64';
 for(const binary of binaries){
  if(binary!==pythonExecutable)regular(binary,{executable:true});
  if(await command('/usr/bin/lipo',['-archs',binary])!==target)throw Error('Final packaged binary architecture mismatch: '+binary);
 }
 const audio=JSON.parse(await command(path.join(resources,helpers.audio),['--self-test']));
 if(audio.protocol!=='CLPA0001'||audio.sampleRate!==48000||audio.channels!==2||audio.maxPacketFrames!==4800)throw Error('Final audio helper protocol mismatch');
 for(const name of ['slides','powerpoint']){
  const probe=JSON.parse(await command(path.join(resources,helpers[name]),['--self-test']));
  if(probe.protocol!==1||probe.selfTest!=='passed'||probe.osOperationVerified!==false)throw Error('Final '+name+' helper protocol mismatch');
 }
 // No capture source or authority is created. stop on a fresh process only
 // returns its inert state and exits; it cannot release any remote holds.
 const inputOutput=await command(path.join(resources,helpers.input),[],{input:JSON.stringify({id:1,op:'stop'})+'\n'});
 const inputReplies=inputOutput.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)).filter(value=>value.id===1);
 const input=inputReplies[0],state=input?.state;
 if(inputReplies.length!==1||input.ok!==true||state?.resourceVersion!=='CastLink.RemoteInput/full-input-pause/2'||state.captureId!==null||state.active!==false||state.ready!==false||state.pointerReady!==false||state.stopped!==true||state.needsEmptyReset!==true)throw Error('Final remote input helper protocol mismatch');
 const identity=JSON.parse(await command(pythonExecutable,['-I','-B','-c','import json,platform,ssl,sqlite3,subprocess,urllib.request,pathlib; print(json.dumps(dict(version=platform.python_version(),machine=platform.machine(),system=platform.system())))'],{timeout:10000}));
 validatePythonIdentity(identity,arch,pin.version);
 const closure=JSON.parse(await command(executable,['-e',closureProbe,resources,arch],{timeout:15000,maxBuffer:1048576,env:{...environment,ELECTRON_RUN_AS_NODE:'1'}}));
 if(closure.platform!=='darwin'||closure.arch!==arch)throw Error('Packaged Electron architecture mismatch');
 if(closure.sourceCommit!==source.sourceCommit)throw Error('Packaged build and setup source manifest do not match');
 if(!isDeepStrictEqual(closure.pythonRuntime,python))throw Error('Packaged build and Python runtime manifest do not match');
 if(closure.sshLoaded!==true||closure.transportLoaded!==true||!isDeepStrictEqual(closure.packages,source.packages))throw Error('Packaged SSH dependency closure mismatch');
 return {schemaVersion:1,status:'PASS',arch,sourceCommit:source.sourceCommit,signature:'PASS',branding:'PASS',nativeArchitectures:'PASS',nativeProtocols:'PASS',pythonRuntime:'PASS',setupSourceIntegrity:'PASS',sshClosure:'PASS',osOperationVerified:false};
}
