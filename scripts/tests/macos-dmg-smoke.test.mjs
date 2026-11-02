import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {runDmgSmoke} from '../macos-dmg-smoke.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const desktopRequire=createRequire(new URL('../../apps/desktop/package.json',import.meta.url));
const builderRequire=createRequire(desktopRequire.resolve('electron-builder/package.json'));
const libraryRequire=createRequire(builderRequire.resolve('app-builder-lib/package.json'));
const {build:plist}=libraryRequire('plist');
function fixture(t,{change,arch='arm64'}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-dmg-smoke-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const artifactDirectory=path.join(root,'artifacts'),temporaryRoot=path.join(root,'temporary'),evidence=path.join(root,'evidence');
 for(const directory of [artifactDirectory,temporaryRoot,evidence])fs.mkdirSync(directory);
 const manifest={platform:'darwin',arch,sourceCommit:'a'.repeat(40),version:'1.2.3',developmentCandidate:true,signed:false,signing:'ad-hoc',notarized:false};
 const name=`CastLink-Client-1.2.3-aaaaaaaaaaaa-mac-${arch}-development.dmg`,dmg=path.join(artifactDirectory,name),manifestFile=path.join(artifactDirectory,'manifest.json'),bytes=Buffer.from('owned DMG fixture');
 fs.writeFileSync(dmg,bytes);fs.writeFileSync(manifestFile,JSON.stringify(manifest));
 fs.writeFileSync(path.join(artifactDirectory,'SHA256SUMS'),hash(bytes)+'  '+name+'\n'+hash(fs.readFileSync(manifestFile))+'  manifest.json\n');
 let attached=false,mount,work,smokes=0;const calls=[];
 const run=(command,args,options)=>{
  calls.push({command,args,options});
  if(command==='/usr/bin/hdiutil'){
   if(args[0]==='verify'){if(change==='verify')throw Error('DMG checksum failed');return '';}
   if(args[0]==='attach'){
    mount=args[args.indexOf('-mountpoint')+1];work=path.dirname(mount);attached=true;
    const app=path.join(mount,change==='wrong-app'?'Other.app':'CastLink Client Development.app');fs.mkdirSync(path.join(app,'Contents/Resources'),{recursive:true});fs.writeFileSync(path.join(app,'Contents/Info.plist'),'fixture plist');fs.writeFileSync(path.join(app,'Contents/Resources/app.asar'),'signed app');
    if(change==='multiple-apps')fs.mkdirSync(path.join(mount,'Second.app'));
    if(change==='partial-attach')throw Error('attach interrupted after mounting');
    return plist({'system-entities':[{'dev-entry':'/dev/disk42s1','mount-point':mount}]});
   }
   if(args[0]==='info')return plist({images:attached?[{'image-path':change==='foreign-mount'?path.join(root,'foreign.dmg'):dmg,'image-alias':Buffer.from('native CFData alias'),'system-entities':[{'dev-entry':'/dev/disk42s1','mount-point':mount}]}]:[]});
   if(args[0]==='detach'){assert.equal(args[1],mount);assert.equal(args.includes('-force'),false);if(change==='detach')throw Error('volume busy');attached=false;return '';}
  }
  if(command==='/usr/sbin/diskutil'){
   let flags=change==='legacy-readonly'?{ReadOnlyVolume:true,ReadOnlyMedia:true}:change==='string-readonly'?{VolumeReadOnly:'true',MediaReadOnly:'true'}:{VolumeReadOnly:!['writable','media-only'].includes(change),MediaReadOnly:!['writable','volume-only'].includes(change)};
   if(change==='actual-3f')flags={WritableVolume:false,WritableMedia:false};
   if(change==='negative-volume-only')flags={WritableVolume:false};
   if(change==='negative-media-only')flags={WritableMedia:false};
   if(change==='missing-negative')flags={};
   if(change==='string-negative')flags={WritableVolume:'false',WritableMedia:'false'};
   if(change==='conflicting-volume')flags={WritableVolume:true,WritableMedia:false};
   if(change==='conflicting-media')flags={WritableVolume:false,WritableMedia:true};
   if(change==='conflicting-general')flags={Writable:true,WritableVolume:false,WritableMedia:false};
   if(change==='conflicting-positive')flags={VolumeReadOnly:true,WritableVolume:true};
   return plist({MountPoint:change==='long-metadata'?'\\'.repeat(3000):change==='wrong-mount'?path.join(root,'other-owned-mount'):mount,DeviceNode:change==='long-metadata'?'"'.repeat(3000):change==='wrong-device'?'/dev/disk99s9':'/dev/disk42s1',Writable:false,VolumeName:'PRIVATE VOLUME LABEL MUST NOT BE LOGGED',SerialNumber:'PRIVATE SERIAL MUST NOT BE LOGGED',...flags});
  }
  if(command==='/usr/bin/plutil'){
   return plist({CFBundleIdentifier:'ru.castlink.client',CFBundleShortVersionString:'1.2.3'});
  }
  if(command==='/usr/bin/ditto'){if(change==='copy')throw Error('copy failed');fs.cpSync(args[0],args[1],{recursive:true,dereference:false});return '';}
  if(command.endsWith('/lsregister'))return '';
  assert.fail('Unexpected native command '+command);
 };
 const smoke=async({bundle,expectedArch,output})=>{
  smokes++;assert.equal(attached,false,'image must be detached before the app launches');assert.equal(expectedArch,arch);assert.ok(bundle.startsWith(path.join(work,'Applications')+path.sep));
  assert.equal(fs.readFileSync(path.join(bundle,'Contents/Resources/app.asar'),'utf8'),'signed app');
  if(change==='smoke')throw Error('copied app smoke failed');
  fs.writeFileSync(output,JSON.stringify({arch:expectedArch,packagedLauncher:'PASS',packagedSetup:'PASS'}));
  fs.writeFileSync(path.join(path.dirname(output),'packaged-resources.json'),JSON.stringify({arch:expectedArch,sourceCommit:change==='source'?'b'.repeat(40):manifest.sourceCommit}));
 };
 return {root,artifactDirectory,temporaryRoot,output:path.join(evidence,'packaged-smoke.json'),manifestFile,dmg,calls,run,smoke,smokes:()=>smokes,attached:()=>attached,work:()=>work};
}
for(const arch of ['arm64','x64'])test(`checks the published ${arch} DMG, copies its app privately, detaches it, and runs the complete smoke exactly once`,async t=>{
 const f=fixture(t,{arch}),result=await runDmgSmoke({artifactDirectory:f.artifactDirectory,expectedArch:arch,output:f.output},{run:f.run,smoke:f.smoke,temporaryRoot:f.temporaryRoot});
 assert.equal(result.status,'PASS');assert.equal(result.signing,'ad-hoc');assert.equal(result.notarized,false);assert.equal(result.readOnlyMount,'PASS');assert.equal(result.privateApplicationCopy,'PASS');assert.equal(result.detachedBeforeLaunch,'PASS');assert.equal(f.smokes(),1);
 assert.deepEqual(fs.readdirSync(f.temporaryRoot),[]);assert.equal(JSON.parse(fs.readFileSync(f.output)).dmgInstall.status,'PASS');
 const attach=f.calls.find(value=>value.args[0]==='attach');for(const flag of ['-readonly','-nobrowse','-noautoopen','-plist'])assert.ok(attach.args.includes(flag));
 assert.ok(f.calls.every(value=>value.options.shell===false&&value.options.timeout>0&&value.options.timeout<=120000&&value.options.killSignal==='SIGKILL'));
 const register=f.calls.filter(value=>value.command.endsWith('/lsregister'));assert.deepEqual(register.map(value=>value.args[0]),['-f','-u']);assert.equal(register[0].args[1],register[1].args[1]);
 assert.equal(f.calls.some(value=>value.args.includes('-force')||value.command.includes('xattr')||value.command.includes('spctl')),false);
});
test('tampered manifests and DMGs are rejected before any native mount command',async t=>{
 for(const change of ['dmg','manifest','arch']){
  const f=fixture(t);
  if(change==='dmg')fs.appendFileSync(f.dmg,'tamper');
  if(change==='manifest')fs.appendFileSync(f.manifestFile,' ');
  await assert.rejects(runDmgSmoke({artifactDirectory:f.artifactDirectory,expectedArch:change==='arch'?'x64':'arm64',output:f.output},{run:f.run,smoke:f.smoke,temporaryRoot:f.temporaryRoot}),/checksum|architecture/i);
  assert.equal(f.calls.length,0);assert.equal(f.smokes(),0);
 }
});
test('mount, app identity, copy and full smoke failures still detach only the owned mount',async t=>{
 for(const change of ['verify','partial-attach','writable','wrong-app','multiple-apps','copy','smoke','source']){
  const f=fixture(t,{change});
  await assert.rejects(runDmgSmoke({artifactDirectory:f.artifactDirectory,expectedArch:'arm64',output:f.output},{run:f.run,smoke:f.smoke,temporaryRoot:f.temporaryRoot}));
  assert.equal(f.attached(),false,change);assert.deepEqual(fs.readdirSync(f.temporaryRoot),[],change);
  assert.equal(JSON.parse(fs.readFileSync(path.join(path.dirname(f.output),'dmg-install.json'))).status,'FAILED');
 }
});
test('real diskutil volume-only and media-only read-only flags both establish a read-only mount',async t=>{
 for(const change of ['volume-only','media-only']){
  const f=fixture(t,{change}),result=await runDmgSmoke({artifactDirectory:f.artifactDirectory,expectedArch:'arm64',output:f.output},{run:f.run,smoke:f.smoke,temporaryRoot:f.temporaryRoot});
  assert.equal(result.readOnlyMount,'PASS');assert.equal(result.ownedDiskProperties.flags.VolumeReadOnly,change==='volume-only');assert.equal(result.ownedDiskProperties.flags.MediaReadOnly,change==='media-only');
 }
});
test('actual 3f native Writable:false/WritableVolume:false/WritableMedia:false schema proves read-only',async t=>{
 for(const change of ['actual-3f','negative-volume-only','negative-media-only']){
  const f=fixture(t,{change}),result=await runDmgSmoke({artifactDirectory:f.artifactDirectory,expectedArch:'arm64',output:f.output},{run:f.run,smoke:f.smoke,temporaryRoot:f.temporaryRoot});
  assert.equal(result.readOnlyMount,'PASS');assert.equal(result.ownedDiskProperties.flags.Writable,false);assert.equal(result.ownedDiskProperties.flags.VolumeReadOnly,null);assert.equal(result.ownedDiskProperties.flags.MediaReadOnly,null);
  assert.equal(result.ownedDiskProperties.flags.WritableVolume,change==='negative-media-only'?null:false);assert.equal(result.ownedDiskProperties.flags.WritableMedia,change==='negative-volume-only'?null:false);
 }
});
test('missing/invalid read-only fields or mismatched native identity fail with bounded selected diagnostics',async t=>{
 for(const change of ['legacy-readonly','string-readonly','missing-negative','string-negative','conflicting-volume','conflicting-media','conflicting-general','conflicting-positive','wrong-device','wrong-mount','writable','long-metadata']){
  const f=fixture(t,{change});let failure;
  await assert.rejects(runDmgSmoke({artifactDirectory:f.artifactDirectory,expectedArch:'arm64',output:f.output},{run:f.run,smoke:f.smoke,temporaryRoot:f.temporaryRoot}),error=>{failure=error;return /DMG mount was not verified read-only:.*expectedMountPoint/.test(error.message);});
  const evidence=JSON.parse(fs.readFileSync(path.join(path.dirname(f.output),'dmg-install.json')));
  assert.equal(evidence.status,'FAILED');assert.ok(evidence.ownedDiskProperties);assert.ok(failure.message.length<2000);assert.doesNotMatch(failure.message,/PRIVATE VOLUME|PRIVATE SERIAL/);
  assert.deepEqual(Object.keys(evidence.ownedDiskProperties).sort(),['DeviceNode','MountPoint','deviceNodeMatches','expectedDeviceNode','expectedMountPoint','flags','mountPointMatches'].sort());
  assert.ok(Object.values(evidence.ownedDiskProperties.flags).every(value=>value===null||typeof value==='boolean'));
  assert.equal(evidence.ownedDiskProperties.deviceNodeMatches,!['wrong-device','long-metadata'].includes(change));assert.equal(evidence.ownedDiskProperties.mountPointMatches,!['wrong-mount','long-metadata'].includes(change));
  assert.equal(f.smokes(),0);assert.equal(f.attached(),false);assert.deepEqual(fs.readdirSync(f.temporaryRoot),[]);
 }
});
test('a busy or foreign mount is never forced or recursively removed',async t=>{
 for(const change of ['detach','foreign-mount']){
  const f=fixture(t,{change});
  await assert.rejects(runDmgSmoke({artifactDirectory:f.artifactDirectory,expectedArch:'arm64',output:f.output},{run:f.run,smoke:f.smoke,temporaryRoot:f.temporaryRoot}),/cleanup|ownership|busy/i);
  assert.equal(f.attached(),true);assert.equal(fs.existsSync(f.work()),true);assert.equal(f.smokes(),0);
  if(change==='foreign-mount')assert.equal(f.calls.some(value=>value.args[0]==='detach'),false);
  assert.equal(f.calls.some(value=>value.args.includes('-force')),false);
 }
});
