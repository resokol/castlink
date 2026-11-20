import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {verifyUpdaterPackage} from './package-updater.mjs';
const {verifyDestination}=createRequire(import.meta.url)('./publish-release-track.cjs');
const REPOSITORY='resokol/castlink',PREFIX=`repos/${REPOSITORY}`;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(ok,message)=>{if(!ok)throw Error(message);};
const positive=value=>Number.isSafeInteger(value)&&value>0;
async function save(file,value){
 const temporary=file+'.'+randomUUID(),handle=await fs.open(temporary,'wx',0o600);
 try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}
 await fs.rename(temporary,file);
}
export function githubApi(){return {async request(method,endpoint,{body,file,accept}={}){
 const args=['api',endpoint,'--method',method];let temporary;
 try{
  if(accept)args.push('-H','Accept: '+accept);
  if(body){temporary=path.join(os.tmpdir(),'castlink-updater-api-'+randomUUID()+'.json');await fs.writeFile(temporary,JSON.stringify(body),{flag:'wx',mode:0o600});args.push('--input',temporary);}
  if(file)args.push('-H','Content-Type: application/octet-stream','--input',file);
  let result;
  try{result=execFileSync('gh',args,{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});}
  catch(error){const status=/HTTP (\d{3})/.exec(error.stderr?.toString()??'');const failure=Error('GitHub API request failed'+(status?' (HTTP '+status[1]+')':''));if(status)failure.status=Number(status[1]);throw failure;}
  return accept==='application/octet-stream'?result:JSON.parse(result.toString('utf8'));
 }finally{if(temporary)await fs.rm(temporary,{force:true});}
}};}
function validateRelease(release,id,manifest,assets,complete=false){
 need(positive(release.id)&&release.id===id&&release.tag_name===manifest.releaseTag,'Wrong numeric release identity');
 need(release.target_commitish===manifest.sourceCommit,'Release source differs');
 need(release.prerelease===false&&typeof release.draft==='boolean','Release must be stable');
 need(Array.isArray(release.assets),'Missing release asset inventory');
 const seen=new Set();
 for(const a of release.assets){
  const expected=assets.find(e=>e.name===a.name);
  need(expected&&!seen.has(a.name)&&positive(a.id)&&a.state==='uploaded'&&a.size===expected.size&&a.digest==='sha256:'+expected.sha256&&a.browser_download_url===`https://github.com/${REPOSITORY}/releases/download/${manifest.releaseTag}/${a.name}`,'Existing draft asset inventory or digest differs');seen.add(a.name);
 }
 if(complete)need(seen.size===assets.length,'Incomplete remote updater asset inventory');
 return release;
}
async function verifyRemote(api,release,assets){
 for(const expected of assets){
  const asset=release.assets.find(a=>a.name===expected.name);
  const data=await api.request('GET',`${PREFIX}/releases/assets/${asset.id}`,{accept:'application/octet-stream'});
  need(Buffer.isBuffer(data)&&data.length===expected.size&&sha(data)===expected.sha256,'Remote updater bytes/digest differ: '+expected.name);
 }
}
async function requireCI(api,commit){
 const result=await api.request('GET',`${PREFIX}/actions/workflows/ci.yml/runs?head_sha=${commit}&event=push&per_page=100`);
 const runs=result.workflow_runs?.filter(r=>r.head_sha===commit&&r.head_branch==='main'&&r.event==='push').sort((a,b)=>b.run_number-a.run_number||b.id-a.id);
 need(runs?.length&&runs[0].status==='completed'&&runs[0].conclusion==='success','Full source CI must pass for this exact main commit');
}
async function verifyTag(api,manifest,optional=false){
 let ref;
 try{ref=(await api.request('GET',`${PREFIX}/git/ref/tags/${manifest.releaseTag}`)).object;}
 catch(error){if(optional&&error.status===404)return;throw error;}
 for(let n=0;n<3&&ref?.type==='tag';n++)ref=(await api.request('GET',`${PREFIX}/git/tags/${ref.sha}`)).object;
 need(ref?.type==='commit'&&ref.sha===manifest.sourceCommit,'Updater tag source differs');
}
async function requireUniqueVersion(api,manifest){
 const matches=[];
 for(let page=1;page<=10;page++){
  const releases=await api.request('GET',`${PREFIX}/releases?per_page=100&page=${page}`);need(Array.isArray(releases),'Invalid release catalog');
  for(const r of releases){
   const match=/^updater-v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))-[a-f0-9]{12}$/.exec(r.tag_name??'');
   if(match?.[1]===manifest.version&&r.prerelease===false)need(r.tag_name===manifest.releaseTag,'Updater version already has a different source identity');
   if(r.tag_name===manifest.releaseTag)matches.push(r);
  }
  if(releases.length<100){need(matches.length<=1,'Duplicate release tag identity');return matches;}
 }
 throw Error('Release catalog bound exceeded');
}
export async function publishUpdater({directory,commit,version='1.0.0',receiptPath,notes,api=githubApi(),context=process.env,source,resumeReleaseId}){
 directory=path.resolve(directory);need(receiptPath,'Publication receipt path required outside the package');receiptPath=path.resolve(receiptPath);
 need(receiptPath!==directory&&!receiptPath.startsWith(directory+path.sep),'Publication receipt must remain outside immutable package');
 need(source?.head===commit&&source.ref==='refs/heads/main'&&source.clean===true&&context.GITHUB_SHA===commit&&context.GITHUB_REF==='refs/heads/main','Exact clean main source and workflow SHA required');
 need(typeof notes==='string'&&notes.trim().length>=30,'Concrete updater release notes required');
 if(resumeReleaseId!==undefined)need(positive(resumeReleaseId),'Explicit numeric release ID required');
 const {manifest,assets}=await verifyUpdaterPackage({directory,commit,version});
 const identity={schemaVersion:1,repository:REPOSITORY,sourceCommit:commit,version,tag:manifest.releaseTag,manifestSha256:assets.find(a=>a.name==='manifest.json').sha256,assets};
 const repository=await api.request('GET',PREFIX);verifyDestination(repository,'primary',context);await requireCI(api,commit);await verifyTag(api,manifest,true);
 await fs.mkdir(path.dirname(receiptPath),{recursive:true});
 const lock=await fs.open(receiptPath+'.lock','wx',0o600);
 try{
  let receipt;
  try{const stat=await fs.lstat(receiptPath);need(stat.isFile()&&!stat.isSymbolicLink(),'Unsafe publication receipt');receipt=JSON.parse(await fs.readFile(receiptPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(receipt)for(const [k,v]of Object.entries(identity))need(JSON.stringify(receipt[k])===JSON.stringify(v),'Publication receipt identity differs');
  const endpoint=id=>`${PREFIX}/releases/${id}`;
  const read=id=>api.request('GET',endpoint(id)).then(r=>validateRelease(r,id,manifest,assets));
  const matches=await requireUniqueVersion(api,manifest);
  let release,id=receipt?.releaseId;
  if(resumeReleaseId!==undefined){need(id===undefined||id===resumeReleaseId,'Numeric resume identity differs');id=resumeReleaseId;}
  if(id!==undefined){need(positive(id),'Invalid receipt numeric release ID');release=await read(id);}
  else{
   if(matches.length){id=matches[0].id;release=await read(id);}
   else{
    need(!receipt,'Create outcome uncertain; recover the exact numeric release ID before retrying');
    receipt={...identity,phase:'create-intent'};await save(receiptPath,receipt);
    try{release=await api.request('POST',`${PREFIX}/releases`,{body:{tag_name:manifest.releaseTag,target_commitish:commit,name:`CastLink Updater ${version}`,draft:true,prerelease:false,make_latest:'false',body:`Source commit: ${commit}\n\n${notes.trim()}`}});}
    catch(error){await save(receiptPath,{...receipt,phase:'create-uncertain'});throw error;}
    id=release.id;validateRelease(release,id,manifest,assets);receipt={...identity,phase:'draft',releaseId:id};await save(receiptPath,receipt);
    release=await read(id); // Fresh drafts need not appear in the release collection yet.
   }
  }
  if(!release.draft){
   need(receipt&&['publish-intent','published'].includes(receipt.phase)&&receipt.releaseId===id,'Already public updater assets are immutable');
  }else{
   receipt={...identity,phase:'draft',releaseId:id};await save(receiptPath,receipt);
   for(const expected of assets){
    release=await read(id);need(release.draft===true,'Already public release is immutable');
    if(release.assets.some(a=>a.name===expected.name))continue;
    await api.request('POST',`https://uploads.github.com/repos/${REPOSITORY}/releases/${id}/assets?name=${encodeURIComponent(expected.name)}`,{file:path.join(directory,expected.name)});
   }
   release=validateRelease(await read(id),id,manifest,assets,true);need(release.draft===true,'Already public release is immutable');await verifyRemote(api,release,assets);
   await requireCI(api,commit);await verifyTag(api,manifest,true);await requireUniqueVersion(api,manifest);receipt={...identity,phase:'publish-intent',releaseId:id};await save(receiptPath,receipt);
   await api.request('PATCH',endpoint(id),{body:{draft:false,prerelease:false,make_latest:'false'}});
   release=await read(id);
  }
  validateRelease(release,id,manifest,assets,true);need(release.draft===false,'Publication was not confirmed');await verifyRemote(api,release,assets);
  await verifyTag(api,manifest);
  receipt={...identity,phase:'published',releaseId:id};await save(receiptPath,receipt);return receipt;
 }finally{await lock.close();await fs.rm(receiptPath+'.lock',{force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [directory,commit,version='1.0.0',receiptPath]=process.argv.slice(2);
 const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const source={head:git(['rev-parse','HEAD']),ref:process.env.GITHUB_REF,clean:git(['status','--porcelain','--untracked-files=no'])===''};
 const resume=process.env.CASTLINK_UPDATER_RESUME_RELEASE_ID;
 try{const result=await publishUpdater({directory,commit,version,receiptPath,notes:process.env.CASTLINK_RELEASE_NOTES,source,resumeReleaseId:resume?Number(resume):undefined});console.log(JSON.stringify(result,null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
