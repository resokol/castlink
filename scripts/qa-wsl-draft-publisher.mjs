// Draft-only, resumable upload of one reviewed immutable candidate. No publication/delete/clobber path.
import fs from 'node:fs/promises';import path from 'node:path';import {createReadStream} from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
const REPO='resokol/castlink',SOURCE='d9a0c6465b512562766fcb42726a59dcdf3fb5c2',VERSION='1.0.2-rc.8',TAG='server-wsl-v1.0.2-rc.8-d9a0c6465b51',RUN='43256796399';
const ARTIFACT={id:13962324070,name:'castlink-server-wsl-candidate-'+SOURCE,size:3694143259,digest:'sha256:b41f7adc080afd629558df7510cf3aea9f806adb0a43d2fe1e7277fb54cc18d9'};
export const NAMES=['CastLink-Server-WSL-amd64.tar.gz','CastLink-Server-WSL-Sources.tar.gz','CastLink-ThirdParty-Sources.tar.gz','packages.tsv','manifest.json','install-server-windows.ps1','LICENSE','THIRD_PARTY_NOTICES','SHA256SUMS'];
const check=v=>{if(!v)throw Error('refused');},sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function keys(v,expected){check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...expected].sort().join(','));}
export function validatePlan(p){
 keys(p,['schemaVersion','repository','sourceCommit','version','tag','factoryRun','artifact','assets']);
 check(p.schemaVersion===1&&p.repository===REPO&&p.sourceCommit===SOURCE&&p.version===VERSION&&p.tag===TAG&&p.factoryRun===RUN);
 keys(p.artifact,Object.keys(ARTIFACT));for(const k of Object.keys(ARTIFACT))check(p.artifact[k]===ARTIFACT[k]);
 check(Array.isArray(p.assets)&&p.assets.length===9&&new Set(p.assets.map(a=>a.name)).size===9);
 for(const a of p.assets){keys(a,['name','size','sha256']);check(NAMES.includes(a.name)&&Number.isSafeInteger(a.size)&&a.size>0&&sha(a.sha256));}return p;
}
export function validateManifest(m,p){
 check(m.schemaVersion===1&&m.sourceCommit===SOURCE&&m.version===VERSION&&m.channel==='server-wsl'&&m.repository===REPO&&m.releaseTag===TAG&&m.architecture==='amd64');
 for(const [key,name] of [['rootfs',NAMES[0]],['sources',NAMES[1]],['upstreamSources',NAMES[2]],['inventory','packages.tsv']]){
  const a=p.assets.find(a=>a.name===name),d=m[key];check(d?.file===name&&d.sha256===a.sha256&&(key==='inventory'||d.size===a.size));
 }
}
export function validateSums(text,p){
 const rows=text.replace(/\r?\n$/,'').split(/\r?\n/),seen=new Set();check(rows.length===8);
 for(const row of rows){const m=/^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/.exec(row);check(m&&m[2]!=='SHA256SUMS'&&!seen.has(m[2])&&p.assets.some(a=>a.name===m[2]&&a.sha256===m[1]));seen.add(m[2]);}
 check(NAMES.filter(n=>n!=='SHA256SUMS').every(n=>seen.has(n)));
}
async function hash(file){const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
export async function verifyFiles(folder,p){
 const dir=await fs.lstat(folder);check(dir.isDirectory()&&!dir.isSymbolicLink());const names=await fs.readdir(folder);check(names.length===9&&names.every(n=>NAMES.includes(n)));
 for(const a of p.assets){const file=path.join(folder,a.name),s=await fs.lstat(file);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size===a.size&&await hash(file)===a.sha256);}
 validateManifest(JSON.parse(await fs.readFile(path.join(folder,'manifest.json'),'utf8')),p);validateSums(await fs.readFile(path.join(folder,'SHA256SUMS'),'utf8'),p);
}
export function validateRelease(r,notes){check(Number.isSafeInteger(r?.id)&&r.id>0&&r.tag_name===TAG&&r.target_commitish===SOURCE&&r.draft===true&&r.prerelease===true&&r.name==='CastLink Server WSL '+VERSION&&r.body===notes);}
export function validateAsset(a,expected){check(Number.isSafeInteger(a?.id)&&a.id>0&&a.name===expected.name&&a.state==='uploaded'&&a.size===expected.size&&a.digest==='sha256:'+expected.sha256);}
export async function main(){
 let stage='inputs';
 try{
  check(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===REPO&&process.versions.node.split('.')[0]==='22'&&!!process.env.GITHUB_TOKEN&&process.argv.length===6);
  const [planFile,folder,notesFile,proofFile]=process.argv.slice(2);
  for(const file of [planFile,notesFile]){const s=await fs.lstat(file);check(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<131072);}
  const p=validatePlan(JSON.parse(await fs.readFile(planFile,'utf8')));
  const notes=(await fs.readFile(notesFile,'utf8')).trimEnd();check(notes.length>0&&!notes.includes('\0'));
  await verifyFiles(folder,p);
  const env={...process.env,GH_HOST:'github.com',GH_PROMPT_DISABLED:'1'};delete env.GH_TOKEN;delete env.GH_ENTERPRISE_TOKEN;
  function gh(args,input,timeout=30000){return execFileSync('gh',args,{input,env,timeout,stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024});}
  const api=(route,body)=>JSON.parse(gh(['api',...(body?['--method','POST','--input','-']:[]),'repos/'+REPO+'/'+route],body?JSON.stringify(body):undefined));
  const list=route=>{const pages=JSON.parse(gh(['api','--paginate','--slurp','repos/'+REPO+'/'+route]));check(Array.isArray(pages)&&pages.every(Array.isArray));return pages.flat();};
  const releaseState=id=>api('releases/'+id);
  const assets=id=>list('releases/'+id+'/assets?per_page=100');
  function tagGuard(){
   const refs=api('git/matching-refs/tags/'+TAG);check(Array.isArray(refs));const exact=refs.filter(r=>r.ref==='refs/tags/'+TAG);check(exact.length<=1);
   if(exact.length){let object=exact[0].object;for(let i=0;object?.type==='tag'&&i<8;i++){check(/^[a-f0-9]{40}$/.test(object.sha));object=api('git/tags/'+object.sha).object;}check(object?.type==='commit'&&object.sha===SOURCE);}
  }
  function assetSet(items){check(items.length<=9&&new Set(items.map(a=>a.name)).size===items.length);for(const a of items){const expected=p.assets.find(e=>e.name===a.name);check(expected);validateAsset(a,expected);}return items;}
  stage='provenance';const repo=JSON.parse(gh(['api','repos/'+REPO]));check(repo.full_name===REPO&&repo.private===false&&repo.archived===false);
  const run=api('actions/runs/'+RUN);check(String(run.id)===RUN&&run.head_sha===SOURCE&&run.status==='completed'&&run.conclusion==='success'&&run.repository?.full_name===REPO&&run.path?.split('@')[0]==='.github/workflows/server-wsl-package.yml');
  const artifact=api('actions/artifacts/'+ARTIFACT.id);check(artifact.id===ARTIFACT.id&&artifact.name===ARTIFACT.name&&artifact.size_in_bytes===ARTIFACT.size&&artifact.digest===ARTIFACT.digest&&artifact.expired===false&&String(artifact.workflow_run?.id)===RUN&&artifact.workflow_run.head_sha===SOURCE);
  const comparison=api('compare/'+SOURCE+'...main');check(['ahead','identical'].includes(comparison.status)&&comparison.merge_base_commit?.sha===SOURCE);
  tagGuard();stage='draft';const releases=list('releases?per_page=100').filter(r=>r.tag_name===TAG);check(releases.length<=1);let release=releases[0];
  if(release)validateRelease(release,notes);else{
   // If creation's response is lost, reconcile once; never issue a second create.
   try{release=api('releases',{tag_name:TAG,target_commitish:SOURCE,name:'CastLink Server WSL '+VERSION,body:notes,draft:true,prerelease:true,make_latest:'false',generate_release_notes:false});}catch{const found=list('releases?per_page=100').filter(r=>r.tag_name===TAG);check(found.length===1);release=found[0];}
   validateRelease(release,notes);
  }
  const id=release.id;const draftGuard=()=>{const matches=list('releases?per_page=100').filter(r=>r.tag_name===TAG);check(matches.length===1&&matches[0].id===id);validateRelease(matches[0],notes);};draftGuard();assetSet(assets(id));
  for(const expected of p.assets){
   stage='asset-'+expected.name;draftGuard();validateRelease(releaseState(id),notes);tagGuard();const before=assetSet(assets(id)),existing=before.find(a=>a.name===expected.name);
   if(!existing){
    // No --clobber. A failed upload may have completed remotely: require exact reconciliation.
    try{gh(['release','upload',TAG,path.resolve(folder,expected.name),'--repo',REPO],undefined,900000);}catch{}
    draftGuard();validateRelease(releaseState(id),notes);const after=assetSet(assets(id)),uploaded=after.filter(a=>a.name===expected.name);check(uploaded.length===1);validateAsset(uploaded[0],expected);
   }
   console.log('draft asset verified: '+expected.name);
  }
  stage='final';draftGuard();validateRelease(releaseState(id),notes);tagGuard();const final=assetSet(assets(id));check(final.length===9);
  const proof={schemaVersion:1,repository:REPO,releaseId:id,tag:TAG,sourceCommit:SOURCE,draft:true,prerelease:true,published:false,assets:final.map(a=>({name:a.name,id:a.id,size:a.size,sha256:a.digest.slice(7)})),verifiedAt:new Date().toISOString()};
  await fs.writeFile(proofFile,JSON.stringify(proof,null,2)+'\n',{flag:'wx',mode:0o600});console.log('draft verified; publication was not performed');
 }catch{console.error('draft preparation failed; stage='+stage+'; code=unverified');process.exitCode=1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
