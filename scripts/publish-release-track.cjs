'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {resolveTrack,assertSource}=require('./release-track.cjs');
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const CANONICAL_RELEASE_REPOSITORY='resokol/castlink';
// New builds use canonical metadata; existing published packages remain immutable.
function releaseDestination(choice='primary'){
  if(choice==='primary')return CANONICAL_RELEASE_REPOSITORY;
  throw Error('Unsupported release destination; only the canonical CastLink repository is allowed');
}
function verifyDestination(repository,choice='primary'){
  const expected=releaseDestination(choice);
  if(repository.full_name!==expected||repository.private!==false||repository.permissions?.push!==true||!repository.default_branch)throw Error('Public writable canonical release repository required');
  return expected;
}
function checkDestination(choice=process.env.CASTLINK_RELEASE_DESTINATION||'primary'){
  const destination=releaseDestination(choice);
  const repository=JSON.parse(execFileSync('gh',['api',`repos/${destination}`],{encoding:'utf8',stdio:['ignore','pipe','inherit']}));
  verifyDestination(repository,choice);return repository;
}
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
  const choice=process.env.CASTLINK_RELEASE_DESTINATION||'primary',destination=releaseDestination(choice);
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),info=resolveTrack(track,sourceCommit);
  assertSource(info,process.env.GITHUB_REF||'refs/heads/'+execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim());
  if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==sourceCommit)throw Error('Workflow source SHA mismatch');
  if(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw Error('Release source tree changed during packaging');
  const notes=process.env.CASTLINK_RELEASE_NOTES;
  if(!notes||notes.trim().length<30)throw Error('Concrete release changes and update instructions required');
  const files=verifyFiles(directory,info);
  const gh=(args,json=false)=>{const output=execFileSync('gh',args,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','inherit']});return json?JSON.parse(output):output;};
  checkDestination(choice);const documents='distribution/';
  const notesFile=path.join(directory,'release-notes.md');
  fs.writeFileSync(notesFile,`CastLink ${info.track} ${info.version}\n\nBuild: ${info.buildNumber}\nSource commit: ${sourceCommit}\n\n${notes.trim()}\n\n[Русский](https://github.com/${destination}/blob/main/${documents}PRODUCTS.md) · [English](https://github.com/${destination}/blob/main/${documents}docs/en/PRODUCTS.md) · [简体中文](https://github.com/${destination}/blob/main/${documents}docs/zh-CN/PRODUCTS.md)\n`);
  // Drafts may return 404 through /releases/tags. List authenticated releases,
  // retain the exact numeric ID, and let authentication/network failures abort.
  const matches=gh(['api',`repos/${destination}/releases?per_page=100`,'--paginate','--slurp'],true).flat().filter(release=>release.tag_name===info.tag);
  if(matches.length>1)throw Error('Multiple releases match this exact tag; inspect before publishing');
  let draft=matches[0]||gh(['api',`repos/${destination}/releases`,'--method','POST','-f',`tag_name=${info.tag}`,'-f',`target_commitish=${sourceCommit}`,'-f',`name=CastLink ${info.track} ${info.version} · ${sourceCommit.slice(0,12)}`,'-F','draft=true','-f',`body=${fs.readFileSync(notesFile,'utf8')}`],true);
  const releaseId=draft.id;
  if(!Number.isSafeInteger(releaseId)||releaseId<=0||draft.tag_name!==info.tag)throw Error('Invalid draft release identity');
  const endpoint=`repos/${destination}/releases/${releaseId}`;
  const readDraft=()=>{
    const release=gh(['api',endpoint],true);
    if(release.id!==releaseId||release.tag_name!==info.tag)throw Error('Invalid draft release identity');
    if(release.draft!==true)throw Error('Published releases are immutable; bump this track version for another release');
    return release;
  };
  draft=readDraft();
  for(const file of files){
    const asset=draft.assets.find(asset=>asset.name===file.name);
    if(asset){
      if(asset.state!=='uploaded'||asset.size!==fs.statSync(file.file).size||asset.digest!==file.digest)throw Error(`Existing draft asset differs; inspect before replacing: ${file.name}`);
      continue;
    }
    // gh streams --input from disk; the binary archive is never a CLI argument.
    gh(['api',`https://uploads.github.com/repos/${destination}/releases/${releaseId}/assets?name=${encodeURIComponent(file.name)}`,'--method','POST','-H','Content-Type: application/octet-stream','--input',file.file]);
  }
  verifyUploaded(readDraft(),info,files);
  // GitHub Latest follows Linux; product update consumers still select their own track.
  const published=gh(['api',endpoint,'--method','PATCH','-F','draft=false','-f','make_latest='+(track==='linux'?'true':'false'),'-f',`body=${fs.readFileSync(notesFile,'utf8')}`],true);
  if(published.id!==releaseId||published.tag_name!==info.tag||published.draft!==false)throw Error('Release publication was not confirmed');
  console.log(`Published ${info.track}: https://github.com/${destination}/releases/tag/${info.tag}`);
}
module.exports={releaseFiles,verifyFiles,verifyUploaded,releaseDestination,verifyDestination,checkDestination,publish};
if(require.main===module){try{if(process.argv[2]==='--check-destination'){const repository=checkDestination();console.log(`Verified release destination: ${repository.full_name}`);}else{const [track,directory]=process.argv.slice(2);publish(track,path.resolve(directory));}}catch(error){console.error(error.message);process.exitCode=1;}}
