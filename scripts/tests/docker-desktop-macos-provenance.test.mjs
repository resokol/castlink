import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const api=await import('../docker-desktop-macos-provenance.mjs').catch(()=>({}));
const digest=b=>createHash('sha256').update(b).digest('hex');
// Inert private bytes exercise SHA/layout gates only; never a vendor DMG/native proof.
const bytes=Buffer.from('INERT_NOT_A_DMG'),checksum=digest(bytes);
const pin={version:'4.94.0',build:'241994',url:'https://desktop.docker.com/mac/main/arm64/241994/Docker.dmg',checksumUrl:'https://desktop.docker.com/mac/main/arm64/241994/checksums.txt',sha256:checksum};
async function fixture(run,{change=null,host={platform:'darwin',arch:'arm64',node:'22.23.3'}}={}){
 const parent=await mkdtemp(path.join(os.tmpdir(),'castlink-mac-provenance-')),directory=path.join(parent,'proof'),calls=[];
 const download=async(url,file,limit)=>{calls.push(['download',url,limit]);const b=url===pin.checksumUrl?Buffer.from(checksum+' *Docker.dmg\n'):change==='tamper'?Buffer.concat([bytes,Buffer.from('x')]):bytes;await writeFile(file,b,{flag:'wx'});};
 const execute=async(command,args)=>{calls.push([command,...args]);let stdout='',stderr='',status=0;
  if(command==='/usr/bin/hdiutil'&&args[0]==='attach'){const mount=args[args.indexOf('-mountpoint')+1];await mkdir(path.join(mount,'Docker.app'),{recursive:true});}
  if(command==='/usr/bin/hdiutil'&&args[0]==='detach'&&change==='detach')status=1;
  if(command==='/usr/bin/plutil'){const key=args[1];stdout=key==='CFBundleIdentifier'?'com.docker.docker':key==='CFBundleShortVersionString'?'4.94.0':'241994';}
  if(command==='/usr/bin/codesign'&&args.includes('--display'))stderr='Identifier=com.docker.docker\nTeamIdentifier=ABCDEFGHIJ\nAuthority=Developer ID Application: Fixture Vendor (ABCDEFGHIJ)\nAuthority=Developer ID Certification Authority\nAuthority=Apple Root CA\n';
  if(command==='/usr/bin/codesign'&&args.includes('--verify')&&change==='signature')status=1;
  if(command==='/usr/sbin/spctl')stderr='fixture: accepted\nsource='+(change==='notarization'?'Developer ID':'Notarized Developer ID')+'\norigin=Developer ID Application: Fixture Vendor (ABCDEFGHIJ)\n';
  return {status,stdout,stderr};
 };
 try{return await run({directory,calls,options:{architecture:'arm64',directory,host,pin,download,execute,space:async()=>({bavail:4*1024**3,bsize:1})}})}finally{await rm(parent,{recursive:true,force:true})}
}
test('pinned provenance refuses wrong native architecture before download or verification',async()=>{assert.equal(typeof api.inspectMacDesktopProvenance,'function');await fixture(async({options,calls})=>{await assert.rejects(api.inspectMacDesktopProvenance(options));assert.equal(calls.length,0)},{host:{platform:'darwin',arch:'x64',node:'22.23.3'}});});
test('modified downloaded DMG never reaches mount or signature commands',async()=>{assert.equal(typeof api.inspectMacDesktopProvenance,'function');await fixture(async({options,calls})=>{await assert.rejects(api.inspectMacDesktopProvenance(options));assert.equal(calls.some(c=>c[0]==='/usr/bin/hdiutil'),false)},{change:'tamper'});});
test('upstream checksum disagreement or insufficient capacity refuses before DMG download',async()=>{
 for(const change of ['checksum','capacity'])await fixture(async({options,calls})=>{
  if(change==='capacity')options.space=async()=>({bavail:2*1024**3,bsize:1});
  else{const get=options.download;options.download=async(url,file,limit)=>{await get(url,file,limit);if(url===pin.checksumUrl)await writeFile(file,'b'.repeat(64)+' *Docker.dmg\n');};}
  await assert.rejects(api.inspectMacDesktopProvenance(options));assert.equal(calls.some(c=>c[0]==='download'&&c[1]===pin.url),false);assert.equal(calls.some(c=>c[0]==='/usr/bin/hdiutil'),false);
 });
});
test('real driver records only typed observed signing evidence and detaches without app execution',async()=>{assert.equal(typeof api.inspectMacDesktopProvenance,'function');await fixture(async({options,calls,directory})=>{const r=await api.inspectMacDesktopProvenance(options);assert.equal(r.installable,false);assert.equal(r.vendorTrustPolicy,'not-established');assert.equal(r.teamId,'ABCDEFGHIJ');assert.equal(r.appIdentifier,'com.docker.docker');assert.equal(r.notarization,'accepted-notarized-developer-id');assert.equal(r.dmgSha256,checksum);assert.equal(calls.at(-1)[1],'detach');assert.equal(calls.some(c=>c.some(v=>typeof v==='string'&&/Docker\.app\/Contents\/MacOS|\/usr\/bin\/open/.test(v))),false);await assert.rejects(readFile(path.join(directory,'Docker.dmg')),e=>e.code==='ENOENT');assert.deepEqual(JSON.parse(await readFile(path.join(directory,'MACOS-DESKTOP-PROVENANCE.json'))),r);});});
test('signature or non-notarized policy refusal still detaches and cannot produce verified metadata',async()=>{assert.equal(typeof api.inspectMacDesktopProvenance,'function');for(const change of ['signature','notarization'])await fixture(async({options,calls,directory})=>{await assert.rejects(api.inspectMacDesktopProvenance(options));assert.equal(calls.at(-1)[1],'detach');const r=JSON.parse(await readFile(path.join(directory,'MACOS-DESKTOP-PROVENANCE.json')));assert.equal(r.status,'unverified');assert.equal(r.installable,false)},{change});});
test('detach failure cannot be relabelled as successful clean provenance',async()=>{assert.equal(typeof api.inspectMacDesktopProvenance,'function');await fixture(async({options,directory})=>{await assert.rejects(api.inspectMacDesktopProvenance(options));const r=JSON.parse(await readFile(path.join(directory,'MACOS-DESKTOP-PROVENANCE.json')));assert.equal(r.status,'unverified');assert.equal(r.cleanup,'incomplete')},{change:'detach'});});
test('signing metadata parser rejects duplicate missing or non-string evidence',()=>{assert.equal(typeof api.parseSigningEvidence,'function');for(const value of [null,['Identifier=com.docker.docker\nTeamIdentifier=ABCDEFGHIJ'], 'Identifier=com.docker.docker\nTeamIdentifier=not set\n','Identifier=com.docker.docker\nTeamIdentifier=ABCDEFGHIJ\nTeamIdentifier=ABCDEFGHIJ\n'])assert.throws(()=>api.parseSigningEvidence(value));});
test('workflow bounds native provenance to private feature packaging paths and metadata artifacts',async()=>{const text=await readFile(new URL('../../.github/workflows/macos-desktop-provenance.yml',import.meta.url),'utf8');assert.match(text,/workflow_dispatch:/);assert.match(text,/branches: \[feat\/self-hosted-cli-github\]/);assert.match(text,/github\.event\.repository\.private/);assert.match(text,/cancel-in-progress: true/);assert.match(text,/macos-15-intel/);assert.match(text,/runner: macos-15\n/);assert.match(text,/retention-days: 7/);assert.match(text,/MACOS-DESKTOP-PROVENANCE\.json/);assert.doesNotMatch(text,/\*\.dmg|paths:[\s\S]*apps\/cli\/src|secrets\./);});
