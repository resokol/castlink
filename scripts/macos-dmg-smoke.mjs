// Verify the actual candidate DMG and exercise only its private installation
// copy. No real Applications directory, quarantine flags, TCC or Gatekeeper
// settings are changed. Integrity is separate from distribution trust.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {runPackagedSmoke} from './macos-client-smoke.mjs';
const LSREGISTER='/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
const desktopRequire=createRequire(new URL('../apps/desktop/package.json',import.meta.url));
const builderRequire=createRequire(desktopRequire.resolve('electron-builder/package.json'));
const libraryRequire=createRequire(builderRequire.resolve('app-builder-lib/package.json'));
// Already pinned by electron-builder: preserve CFData/CFDate in hdiutil output,
// which cannot in general be represented by plutil's JSON conversion.
const plist=libraryRequire('plist');
function regular(file){if(!fs.lstatSync(file).isFile())throw Error('Required DMG artifact must be a regular file: '+path.basename(file));}
async function checksum(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
function samePath(a,b){if(typeof a!=='string'||typeof b!=='string')return false;try{return fs.realpathSync(a)===fs.realpathSync(b);}catch{return path.resolve(a)===path.resolve(b);}}
async function verifyArtifact(directory,arch){
 const manifestFile=path.join(directory,'manifest.json'),sumsFile=path.join(directory,'SHA256SUMS');regular(manifestFile);regular(sumsFile);
 const sums=new Map();
 for(const line of fs.readFileSync(sumsFile,'utf8').trim().split(/\r?\n/)){
  const match=/^([a-f0-9]{64})  ([^/\\\x00-\x1f]+)$/.exec(line);
  if(!match||['.','..'].includes(match[2])||sums.has(match[2]))throw Error('Invalid or duplicate artifact checksum entry');sums.set(match[2],match[1]);
 }
 if(await checksum(manifestFile)!==sums.get('manifest.json'))throw Error('Artifact manifest checksum mismatch');
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 if(manifest.platform!=='darwin'||manifest.arch!==arch)throw Error('DMG artifact architecture does not match the native target');
 if(!/^[a-f0-9]{40}$/.test(manifest.sourceCommit)||typeof manifest.version!=='string'||!/^[0-9A-Za-z.+-]{1,80}$/.test(manifest.version))throw Error('Invalid DMG artifact source identity');
 if(manifest.developmentCandidate!==true||manifest.signed!==false||manifest.signing!=='ad-hoc'||manifest.notarized!==false)throw Error('This install smoke requires the explicit ad-hoc, non-notarized development candidate');
 const filename=`CastLink-Client-${manifest.version}-${manifest.sourceCommit.slice(0,12)}-mac-${arch}-development.dmg`;
 const candidates=fs.readdirSync(directory).filter(name=>/\.dmg$/i.test(name));
 if(candidates.length!==1||candidates[0]!==filename)throw Error('Expected exactly the source- and architecture-matched DMG artifact');
 const dmg=path.join(directory,filename);regular(dmg);const digest=await checksum(dmg);
 if(digest!==sums.get(filename))throw Error('DMG artifact checksum mismatch');
 return {manifest,dmg,filename,sha256:digest};
}

export async function runDmgSmoke({artifactDirectory,expectedArch,output},{run=execFileSync,smoke=runPackagedSmoke,temporaryRoot=os.tmpdir()}={}){
 if(!['arm64','x64'].includes(expectedArch))throw Error('Explicit native macOS architecture required');
 if(run===execFileSync&&(process.platform!=='darwin'||process.arch!==expectedArch))throw Error('DMG installation smoke requires the native target macOS host');
 if(typeof artifactDirectory!=='string'||!path.isAbsolute(artifactDirectory)||typeof output!=='string'||!path.isAbsolute(output)||!path.isAbsolute(temporaryRoot))throw Error('Absolute artifact, output and temporary paths required');
 artifactDirectory=fs.realpathSync(artifactDirectory);fs.mkdirSync(path.dirname(output),{recursive:true});
 const evidenceFile=path.join(path.dirname(output),'dmg-install.json');
 const report={schemaVersion:1,status:'FAILED',arch:expectedArch,readOnlyMount:'NOT VERIFIED',privateApplicationCopy:'NOT VERIFIED',detachedBeforeLaunch:'NOT VERIFIED',copiedAppSmoke:'NOT VERIFIED',signing:'ad-hoc',signed:false,notarized:false,quarantineBypass:false,gatekeeperAcceptance:'NOT VERIFIED'};
 let failure,work,mount,dmg,installed,attachAttempted=false,registerAttempted=false,preserveWork=false;
 async function command(executable,args,{timeout=30000,...options}={}){
  return String(await run(executable,args,{encoding:'utf8',shell:false,timeout,maxBuffer:1048576,killSignal:'SIGKILL',...options}));
 }
 function decodePlist(bytes){return plist.parse(bytes);}
 async function mountsAtOwnedPoint(){
  const info=await decodePlist(await command('/usr/bin/hdiutil',['info','-plist']));
  if(!Array.isArray(info.images))throw Error('Cannot verify disk image mount ownership');
  const found=[];
  for(const image of info.images){
   if(!Array.isArray(image['system-entities']))throw Error('Cannot verify disk image mount ownership');
   for(const entity of image['system-entities'])if(samePath(entity['mount-point'],mount))found.push({image,entity});
  }
  return found;
 }
 async function detachOwned(){
  const found=await mountsAtOwnedPoint();if(found.length===0)return;
  if(found.length!==1||!samePath(found[0].image['image-path'],dmg))throw Error('Mount ownership changed; refusing to detach an unowned image');
  await command('/usr/bin/hdiutil',['detach',mount],{timeout:30000});
  if((await mountsAtOwnedPoint()).length)throw Error('Owned DMG mount remained after detach');
 }
 try{
  const artifact=await verifyArtifact(artifactDirectory,expectedArch);dmg=artifact.dmg;
  Object.assign(report,{artifact:artifact.filename,sha256:artifact.sha256,sourceCommit:artifact.manifest.sourceCommit,artifactChecksums:'PASS'});
  work=fs.realpathSync(fs.mkdtempSync(path.join(temporaryRoot,'castlink-dmg-install-')));fs.chmodSync(work,0o700);
  mount=path.join(work,'mounted');const applications=path.join(work,'Applications');fs.mkdirSync(mount,{mode:0o700});fs.mkdirSync(applications,{mode:0o700});
  await command('/usr/bin/hdiutil',['verify',dmg],{timeout:60000});report.containerIntegrity='PASS';
  attachAttempted=true;
  const attachment=await decodePlist(await command('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-plist','-mountpoint',mount,dmg],{timeout:60000}));
  const volumes=attachment['system-entities']?.filter(entity=>typeof entity['mount-point']==='string');
  if(!Array.isArray(volumes)||volumes.length!==1||!samePath(volumes[0]['mount-point'],mount)||!/^\/dev\/disk[0-9]+(?:s[0-9]+)*$/.test(volumes[0]['dev-entry'])){
   preserveWork=true;throw Error('DMG did not attach solely at its owned mountpoint; unexpected mounts will not be touched');
  }
  const ownership=await mountsAtOwnedPoint();
  if(ownership.length!==1||!samePath(ownership[0].image['image-path'],dmg)||ownership[0].entity['dev-entry']!==volumes[0]['dev-entry'])throw Error('DMG image ownership was not verified');
  const disk=await decodePlist(await command('/usr/sbin/diskutil',['info','-plist',mount]));
  const bounded=(value,limit)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'?').slice(0,limit):null;
  const mountPointMatches=samePath(disk.MountPoint,mount),deviceNodeMatches=disk.DeviceNode===volumes[0]['dev-entry'];
  // Native diskutil versions expose either positive ReadOnly flags or the
  // negative WritableVolume/WritableMedia family. Require an exact boolean
  // assertion and reject any explicit writable flag; Writable:false alone is
  // not enough to establish the volume/media's read-only state.
  report.ownedDiskProperties={expectedMountPoint:bounded(mount,256),MountPoint:bounded(disk.MountPoint,256),expectedDeviceNode:bounded(volumes[0]['dev-entry'],64),DeviceNode:bounded(disk.DeviceNode,64),mountPointMatches,deviceNodeMatches,flags:Object.fromEntries(['VolumeReadOnly','MediaReadOnly','Writable','WritableVolume','WritableMedia','ReadOnlyVolume','ReadOnlyMedia','Mounted'].map(key=>[key,typeof disk[key]==='boolean'?disk[key]:null]))};
  const readOnly=disk.VolumeReadOnly===true||disk.MediaReadOnly===true||disk.WritableVolume===false||disk.WritableMedia===false;
  const writableConflict=['Writable','WritableVolume','WritableMedia'].some(key=>disk[key]===true);
  if(!mountPointMatches||!deviceNodeMatches||!readOnly||writableConflict)throw Error('DMG mount was not verified read-only: '+JSON.stringify(report.ownedDiskProperties));
  report.readOnlyMount='PASS';
  const apps=fs.readdirSync(mount).filter(name=>/\.app$/i.test(name));
  if(apps.length!==1||apps[0]!=='CastLink Client Development.app'||!fs.lstatSync(path.join(mount,apps[0])).isDirectory())throw Error('DMG must contain exactly the expected CastLink application');
  const source=path.join(mount,apps[0]),plistFile=path.join(source,'Contents/Info.plist');regular(plistFile);
  const identity=decodePlist(await command('/usr/bin/plutil',['-convert','xml1','-o','-',plistFile]));
  if(identity.CFBundleIdentifier!=='ru.castlink.client'||identity.CFBundleShortVersionString!==artifact.manifest.version)throw Error('DMG application identity does not match its artifact manifest');
  installed=path.join(applications,apps[0]);await command('/usr/bin/ditto',[source,installed],{timeout:120000});
  if(!fs.lstatSync(installed).isDirectory())throw Error('Private application copy was not produced');
  const sourceAsar=path.join(source,'Contents/Resources/app.asar'),installedAsar=path.join(installed,'Contents/Resources/app.asar');regular(sourceAsar);regular(installedAsar);
  if(await checksum(sourceAsar)!==await checksum(installedAsar))throw Error('Copied application resource checksum does not match the DMG');
  report.privateApplicationCopy='PASS';
  await detachOwned();attachAttempted=false;report.detachedBeforeLaunch='PASS';
  // Register exactly this private installation so the full smoke's real
  // NSWorkspace handler-path check must identify the copied candidate.
  registerAttempted=true;await command(LSREGISTER,['-f',installed]);
  await smoke({bundle:installed,expectedArch,output});
  const resources=JSON.parse(fs.readFileSync(path.join(path.dirname(output),'packaged-resources.json'),'utf8'));
  if(resources.arch!==expectedArch||resources.sourceCommit!==artifact.manifest.sourceCommit)throw Error('Copied app source does not match the DMG artifact manifest');
  const launcher=JSON.parse(fs.readFileSync(output,'utf8'));
  if(launcher.arch!==expectedArch||launcher.packagedLauncher!=='PASS'||launcher.packagedSetup!=='PASS')throw Error('Copied application full smoke did not produce successful evidence');
  report.copiedAppSmoke='PASS';
 }catch(error){failure=error;}
 finally{
  if(registerAttempted){try{await command(LSREGISTER,['-u',installed]);}catch(error){failure??=error;report.launchServicesCleanup='FAILED';}}
  if(attachAttempted){try{await detachOwned();attachAttempted=false;}catch(error){failure=Error((failure?failure.message+'; ':'')+'owned mount cleanup incomplete: '+error.message);preserveWork=true;}}
  if(work&&!preserveWork){try{fs.rmSync(work,{recursive:true,force:true});}catch(error){failure??=error;preserveWork=true;}}
  if(preserveWork)report.retainedWorkDirectory=work;
  report.cleanup=preserveWork||report.launchServicesCleanup==='FAILED'?'incomplete':'complete';report.status=failure?'FAILED':'PASS';
  if(failure)report.reason=String(failure.message).slice(0,2000);
  fs.writeFileSync(evidenceFile,JSON.stringify(report,null,2)+'\n');
  if(fs.existsSync(output)){
   const prior=JSON.parse(fs.readFileSync(output,'utf8'));fs.writeFileSync(output,JSON.stringify({...prior,dmgInstall:report},null,2)+'\n');
  }
 }
 if(failure)throw Error('DMG installation smoke failed: '+failure.message);return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [artifactDirectory,expectedArch,output]=process.argv.slice(2);
 const evidence=await runDmgSmoke({artifactDirectory,expectedArch,output});console.log(JSON.stringify(evidence));
}
