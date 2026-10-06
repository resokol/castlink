#!/usr/bin/env node
// Private CI evidence collector only. Does not install or execute vendor code.
import {createHash} from 'node:crypto';
import {mkdir,open,lstat,realpath,readFile,writeFile,unlink,statfs} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const DESKTOP_PINS=JSON.parse(await readFile(new URL('./docker-desktop-macos-pins.json',import.meta.url),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=phase=>{const e=Error('Docker Desktop read-only provenance is unverified ('+phase+').');e.phase=phase;throw e;};
function result(r,phase){if(!r||r.error||r.signal||r.status!==0||typeof r.stdout!=='string'||typeof r.stderr!=='string'||Buffer.byteLength(r.stdout)+Buffer.byteLength(r.stderr)>32768)fail(phase);return r;}
function execute(command,args){return spawnSync(command,args,{shell:false,encoding:'utf8',timeout:120000,maxBuffer:32768,windowsHide:true});}
async function download(url,file,limit){
 if(!/^https:\/\/desktop\.docker\.com\/mac\/main\/(?:arm64|amd64)\/241994\/(?:Docker\.dmg|checksums\.txt)$/.test(url))fail('download-url');
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(600000)});if(!r.ok||!r.body)fail('download');
 const h=await open(file,'wx',0o600);let count=0;
 try{for await(const chunk of r.body){count+=chunk.byteLength;if(count>limit)fail('download-size');await h.writeFile(chunk);}await h.sync();}finally{await h.close();}
}
async function fileHash(file,limit){const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const before=await h.stat();if(!before.isFile()||before.size>limit)fail('download-size');const hash=createHash('sha256'),b=Buffer.alloc(65536);let size=0,n;while((n=(await h.read(b,0,b.length,null)).bytesRead)>0){size+=n;if(size>limit||size>before.size)fail('download-size');hash.update(b.subarray(0,n));}const after=await h.stat(),named=await lstat(file);if(size!==before.size||after.size!==size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||named.isSymbolicLink()||named.dev!==before.dev||named.ino!==before.ino)fail('download-changed');return{sha256:hash.digest('hex'),bytes:size};}finally{await h.close();}}
async function smallSnapshot(file,limit){
 const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const before=await h.stat();if(!before.isFile()||before.size>limit)fail('upstream-checksum');const b=Buffer.alloc(before.size+1);let size=0,n;while(size<b.length&&(n=(await h.read(b,size,b.length-size,null)).bytesRead)>0)size+=n;const after=await h.stat(),named=await lstat(file);if(size!==before.size||after.size!==size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||named.isSymbolicLink()||named.dev!==before.dev||named.ino!==before.ino)fail('upstream-checksum');return b.subarray(0,size);}finally{await h.close();}
}
// Capture only the fixed system spctl invocation, never environment or Error.message.
// Prefix allocation/output remains bounded even for an oversized diagnostic fixture.
function spctlObservation(r){
 const bounded=value=>{if(typeof value!=='string')return{text:'',bytes:null,truncated:false};const bytes=Buffer.byteLength(value),cap=16384;let text=Buffer.from(value.slice(0,cap)).subarray(0,cap).toString('utf8');while(Buffer.byteLength(text)>cap)text=text.slice(0,-1);return{text,bytes,truncated:bytes>Buffer.byteLength(text)};};
 const out=bounded(r?.stdout),err=bounded(r?.stderr);
 return{status:Number.isSafeInteger(r?.status)&&r.status>=0?r.status:null,signal:typeof r?.signal==='string'&&/^SIG[A-Z0-9]{1,16}$/.test(r.signal)?r.signal:null,errorCode:r?.error?(typeof r.error.code==='string'&&/^[A-Z][A-Z0-9_]{0,31}$/.test(r.error.code)?r.error.code:'UNKNOWN'):null,stdout:out.text,stderr:err.text,stdoutBytes:out.bytes,stderrBytes:err.bytes,truncated:out.truncated||err.truncated};
}
export function parseSigningEvidence(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>32768)fail('signature-metadata');
 const values=key=>text.split(/\r?\n/).filter(s=>s.startsWith(key+'=')).map(s=>s.slice(key.length+1));
 const ids=values('Identifier'),teams=values('TeamIdentifier'),authorities=values('Authority');
 if(ids.length!==1||!/^[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)+$/.test(ids[0])||teams.length!==1||!/^[A-Z0-9]{10}$/.test(teams[0])||authorities.length<2||authorities.length>8||authorities.some(a=>a.length>256||/[\x00-\x1f\x7f]/.test(a))||!authorities[0].startsWith('Developer ID Application: ')||!authorities[0].endsWith(' ('+teams[0]+')')||authorities.at(-1)!=='Apple Root CA')fail('signature-metadata');
 return{appIdentifier:ids[0],teamId:teams[0],authorities};
}
export async function inspectMacDesktopProvenance({architecture,directory,host={platform:process.platform,arch:process.arch,node:process.versions.node},pin=DESKTOP_PINS.targets[architecture],execute:run=execute,download:get=download,space:readSpace=statfs}){
 // pin/host/transport seams are for inert offline tests. CLI uses frozen defaults.
 if(!['arm64','x64'].includes(architecture)||host.platform!=='darwin'||host.arch!==architecture||host.node!=='22.23.3')fail('native-runner');
 if(!pin||pin.version!=='4.94.0'||pin.build!=='241994'||typeof pin.sha256!=='string'||!/^[a-f0-9]{64}$/.test(pin.sha256)||typeof directory!=='string'||!path.isAbsolute(directory))fail('input');
 await mkdir(directory,{mode:0o700});
 const dmg=path.join(directory,'Docker.dmg'),listing=path.join(directory,'checksums.txt'),mount=path.join(directory,'readonly-mount'),app=path.join(mount,'Docker.app');
 let phase='capacity',attachAttempted=false,mounted=false,observed={},assessmentEvidence=null,error=null,cleanup='complete';
 try{
  const space=await readSpace(directory);if(Number(space.bavail)*Number(space.bsize)<3*1024**3)fail(phase);
  phase='upstream-checksum';await get(pin.checksumUrl,listing,65536);
  const checksumBytes=await smallSnapshot(listing,65536);if(checksumBytes.toString('utf8').trim()!==pin.sha256+' *Docker.dmg')fail(phase);observed.checksumListingSha256=sha(checksumBytes);
  phase='dmg-sha256';await get(pin.url,dmg,2*1024**3);const archive=await fileHash(dmg,2*1024**3);if(archive.sha256!==pin.sha256)fail(phase);Object.assign(observed,{dmgSha256:archive.sha256,dmgBytes:archive.bytes});
  phase='readonly-mount';await mkdir(mount,{mode:0o700});attachAttempted=true;result(await run('/usr/bin/hdiutil',['attach','-readonly','-nobrowse','-noautoopen','-plist','-mountpoint',mount,dmg]),phase);mounted=true;
  const a=await lstat(app);if(!a.isDirectory()||a.isSymbolicLink()||await realpath(app)!==app)fail('app-path');
  phase='bundle-metadata';const info=path.join(app,'Contents','Info.plist'),value=async key=>result(await run('/usr/bin/plutil',['-extract',key,'raw','-o','-',info]),phase).stdout.trim();
  const appIdentifier=await value('CFBundleIdentifier'),version=await value('CFBundleShortVersionString'),build=await value('CFBundleVersion');if(version!==pin.version||build!==pin.build)fail(phase);Object.assign(observed,{appIdentifier,version,build});
  phase='signature';result(await run('/usr/bin/codesign',['--verify','--deep','--strict',app]),phase);observed.signature='verified-deep-strict';const display=result(await run('/usr/bin/codesign',['--display','--verbose=4',app]),phase),signing=parseSigningEvidence(display.stderr);if(signing.appIdentifier!==appIdentifier)fail('app-identifier');Object.assign(observed,signing);
  phase='notarization';observed.notarization='unverified';let rawAssessment;try{rawAssessment=await run('/usr/sbin/spctl',['--assess','--type','execute','--verbose=4',app]);assessmentEvidence=spctlObservation(rawAssessment);}catch(e){assessmentEvidence=spctlObservation({status:null,signal:null,error:e,stdout:'',stderr:''});throw e;}const assessment=result(rawAssessment,phase);if(!/^.+: accepted\r?$/m.test(assessment.stderr)||!/^source=Notarized Developer ID\r?$/m.test(assessment.stderr)||assessment.stderr.split(/\r?\n/).filter(s=>s.startsWith('source=')).length!==1||!assessment.stderr.includes('origin='+signing.authorities[0]))fail(phase);
  observed.notarization='accepted-notarized-developer-id';
 }catch(e){error=e;}
 finally{
  // Failed attach may have mounted a volume before returning a nonzero status.
  if(attachAttempted){try{result(await run('/usr/bin/hdiutil',['detach',mount]),'detach');mounted=false;}catch(e){cleanup='incomplete';error??=e;}}
  if(!mounted&&cleanup==='complete'){for(const f of [dmg,listing])try{await unlink(f);}catch(e){if(e.code!=='ENOENT'){cleanup='incomplete';error??=e;}}}
 }
 const metadata={schemaVersion:1,status:error?'unverified':'readonly-provenance-observed',distribution:'private-development-evidence-only',installable:false,productionEligible:false,vendorTrustPolicy:'not-established',architecture,pinnedVersion:pin.version,pinnedBuild:pin.build,upstreamUrl:pin.url,checksumUrl:pin.checksumUrl,releaseNotesUrl:DESKTOP_PINS.releaseNotesUrl,sourceCommit:/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA??'')?process.env.GITHUB_SHA:null,...observed,...(assessmentEvidence?{spctlObservation:assessmentEvidence}:{}),cleanup,diagnosis:error?(error.phase??phase):null,physicalMacMediaAcceptance:'unverified',projectLicense:'unselected'};
 const encoded=JSON.stringify(metadata,null,2)+'\n';if(Buffer.byteLength(encoded)>262144)fail('metadata-size');await writeFile(path.join(directory,'MACOS-DESKTOP-PROVENANCE.json'),encoded,{flag:'wx',mode:0o600});
 if(error)fail(metadata.diagnosis);return metadata;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.length!==2){console.error('Usage: node scripts/docker-desktop-macos-provenance.mjs arm64|x64 NEW_PRIVATE_OUTPUT_DIRECTORY');process.exitCode=4;}
 else inspectMacDesktopProvenance({architecture:args[0],directory:path.resolve(args[1])}).then(r=>console.log(JSON.stringify({schemaVersion:r.schemaVersion,status:r.status,architecture:r.architecture,cleanup:r.cleanup}))).catch(e=>{console.error(e.phase?'Unverified read-only provenance: '+e.phase:'Unverified read-only provenance.');process.exitCode=4;});
}
