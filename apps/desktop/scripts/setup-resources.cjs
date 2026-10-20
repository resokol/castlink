'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {resolveTrack}=require('../../../scripts/release-track.cjs');

// This is the lightweight closure of the existing WPF wizard, not a second
// installer. Server payloads retain their existing release/SHA256 verification.
const SETUP_SOURCE_FILES=Object.freeze([
  'LICENSE','THIRD_PARTY_NOTICES',
  'scripts/windows-simple-easy-setup.ps1',
  'scripts/simple-easy-setup-gui.ps1',
  'scripts/simple-easy-setup-window.xaml',
  'scripts/simple-easy-setup-control.ico',
  'scripts/simple-easy-setup-language.ps1',
  'scripts/simple-easy-setup-release.json',
  'scripts/simple-easy-setup-download.ps1',
  'scripts/simple-easy-setup-runtime.ps1',
  'scripts/simple-easy-setup-deploy.ps1',
  'scripts/simple-easy-setup-network.ps1',
  'scripts/simple-easy-setup-ssh.ps1',
  'scripts/simple-easy-setup-cleanup.ps1',
  'scripts/simple-easy-setup-trust.ps1',
  'scripts/simple-easy-setup-reserves.ps1',
  'scripts/simple-easy-setup-control.ps1',
  'scripts/server-ssh-authorize-key.py',
  'scripts/ubuntu-easy-setup-bootstrap.sh',
]);
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function stageSetupResources(root,destination,sourceCommit){
  if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Exact source commit required');
  const directory=path.join(destination,'setup');
  if(fs.existsSync(directory))throw Error('Setup resource destination already exists');
  const product=resolveTrack('server-setup',sourceCommit,root);
  const inputs=SETUP_SOURCE_FILES.map(relative=>{
    const source=path.join(root,relative);
    if(!fs.lstatSync(source).isFile())throw Error('Setup source must be a regular file: '+relative);
    const original=fs.readFileSync(source);
    // Match the released PS5 producer: explicit UTF-8 BOM and CRLF. Record
    // source and staged hashes separately so this normalization is reviewable.
    const bytes=relative.endsWith('.ps1')?Buffer.from('\ufeff'+original.toString('utf8').replace(/^\ufeff/,'').replace(/\r?\n/g,'\r\n')):original;
    return {relative,bytes,sourceSha256:sha256(original)};
  });
  inputs.push({relative:'payload/release.json',bytes:Buffer.from(JSON.stringify({...product,commit:sourceCommit},null,2)+'\n')});
  const manifest={schemaVersion:1,sourceCommit,files:{}};
  for(const {relative,bytes,sourceSha256} of inputs){
    const file=path.join(directory,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
    manifest.files[relative]={sha256:sha256(bytes),size:bytes.length,...(sourceSha256?{sourceSha256}:{})};
  }
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {directory,manifest};
}
module.exports={SETUP_SOURCE_FILES,stageSetupResources};

