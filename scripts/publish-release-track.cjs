'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {resolveTrack,assertSource}=require('./release-track.cjs');
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function releaseFiles(info){
  const common=['manifest.json','SHA256SUMS'];
  if(info.track==='client')return [...common,`CastLink-${info.version}-${info.sourceCommit.slice(0,12)}-Windows.exe`,`CastLink-Client-${info.version}-${info.sourceCommit.slice(0,12)}-setup.exe`,`CastLink-Client-${info.version}-${info.sourceCommit.slice(0,12)}-win-x64.zip`];
  return [...common,...(info.track==='server-setup'?['CastLink-Windows.zip']:[]),'CastLink-Linux.tar.gz','CastLink-Provisioning.json','CastLink-ThirdParty-Sources.tar.gz','CastLink-ThirdParty-Office-Sources.tar.gz'];
}
function verifyFiles(directory,info){
  const names=releaseFiles(info),sums=new Map();
  for(const line of fs.readFileSync(path.join(directory,'SHA256SUMS'),'utf8').trim().split(/\r?\n/)){
    const match=/^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/.exec(line);
    if(!match||sums.has(match[2]))throw Error('Invalid or duplicate checksum');
    sums.set(match[2],match[1]);
  }
  for(const name of names){
    const file=path.join(directory,name),stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.size===0)throw Error(`Missing release file: ${name}`);
    if(name!=='SHA256SUMS'&&sums.get(name)!==sha256(file))throw Error(`Checksum mismatch: ${name}`);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
  for(const key of ['schemaVersion','track','version','buildNumber','sourceCommit','tag','repository','branch'])if(manifest[key]!==info[key])throw Error(`Release provenance mismatch: ${key}`);
  return names.map(name=>({name,file:path.join(directory,name),digest:`sha256:${sha256(path.join(directory,name))}`}));
}
function verifyUploaded(release,info,files){
  if(release.tag_name!==info.tag||release.draft!==true)throw Error('Only this exact draft can be published');
  if(release.assets.length!==files.length)throw Error('Unexpected release assets; inspect the draft');
  for(const file of files){const asset=release.assets.find(asset=>asset.name===file.name);if(!asset||asset.state!=='uploaded'||asset.size!==fs.statSync(file.file).size||asset.digest!==file.digest)throw Error(`Uploaded bytes not verified: ${file.name}`);}
}
function publish(track,directory){
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),info=resolveTrack(track,sourceCommit);
  assertSource(info,process.env.GITHUB_REF||'refs/heads/'+execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim());
  if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==sourceCommit)throw Error('Workflow source SHA mismatch');
  if(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw Error('Release source tree changed during packaging');
  const notes=process.env.CASTLINK_RELEASE_NOTES;
  if(!notes||notes.trim().length<30)throw Error('Concrete release changes and update instructions required');
  const files=verifyFiles(directory,info);
  const gh=(args,json=false)=>{const output=execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','inherit']});return json?JSON.parse(output):output;};
  const repository=gh(['api',`repos/${info.repository}`],true);
  if(repository.full_name!==info.repository||repository.private!==false||repository.permissions?.push!==true)throw Error('Public writable distribution repository required');
  const notesFile=path.join(directory,'release-notes.md');
  fs.writeFileSync(notesFile,`CastLink ${info.track} ${info.version}\n\nBuild: ${info.buildNumber}\nSource commit: ${sourceCommit}\n\n${notes.trim()}\n\n[Русский](https://github.com/${info.repository}/blob/main/PRODUCTS.md) · [English](https://github.com/${info.repository}/blob/main/docs/en/PRODUCTS.md) · [简体中文](https://github.com/${info.repository}/blob/main/docs/zh-CN/PRODUCTS.md)\n`);
  let draft;
  try{draft=gh(['api',`repos/${info.repository}/releases/tags/${info.tag}`],true);}catch{
    gh(['release','create',info.tag,'--repo',info.repository,'--target',repository.default_branch,'--draft','--title',`CastLink ${info.track} ${info.version} · ${sourceCommit.slice(0,12)}`,'--notes-file',notesFile]);
    draft=gh(['api',`repos/${info.repository}/releases/tags/${info.tag}`],true);
  }
  if(draft.draft!==true||draft.tag_name!==info.tag)throw Error('Published releases are immutable; bump this track version for another release');
  gh(['release','upload',info.tag,'--repo',info.repository,'--clobber',...files.map(file=>file.file)]);
  verifyUploaded(gh(['api',`repos/${info.repository}/releases/tags/${info.tag}`],true),info,files);
  // Global /latest remains the legacy combined channel. Consumers select a track.
  gh(['release','edit',info.tag,'--repo',info.repository,'--notes-file',notesFile,'--draft=false','--latest=false']);
  console.log(`Published ${info.track}: https://github.com/${info.repository}/releases/tag/${info.tag}`);
}
module.exports={releaseFiles,verifyFiles,verifyUploaded};
if(require.main===module){try{const [track,directory]=process.argv.slice(2);publish(track,path.resolve(directory));}catch(error){console.error(error.message);process.exitCode=1;}}
