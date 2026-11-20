import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {assembleUpdaterPackage,verifyUpdaterPackage,UPDATER_FILES} from '../package-updater.mjs';

const moduleUrl=new URL('../publish-updater.mjs',import.meta.url);
const load=async()=>{try{return await import(moduleUrl.href);}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND')assert.fail('Updater publisher is not implemented');throw e;}};
const commit='a'.repeat(40),version='1.0.0',tag=`updater-v${version}-${commit.slice(0,12)}`;
const context={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'resokol/castlink',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:commit};
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'updater-publish-'));
 for(const file of Object.values(UPDATER_FILES)){const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,'tested fixture '+file+'\n');}
 const directory=path.join(root,'package');await assembleUpdaterPackage({root,output:directory,commit,version});
 const verified=await verifyUpdaterPackage({directory,commit,version}),payload=new Map();let next=100;
 const fake={releases:[],calls:[],hideCreated:true,createLost:false,uploadLost:false,publishLost:false,ci:'success',
  async request(method,endpoint,options={}){
   this.calls.push({method,endpoint,body:options.body});
   if(endpoint==='repos/resokol/castlink')return {full_name:'resokol/castlink',private:false,default_branch:'main',permissions:{push:true}};
   if(endpoint.includes('/actions/workflows/ci.yml/runs?'))return {workflow_runs:[{id:99,run_number:2,head_sha:commit,head_branch:'main',event:'push',status:'completed',conclusion:this.ci}]};
   if(endpoint.includes('/git/ref/tags/'))return {object:{type:'commit',sha:commit}};
   if(method==='GET'&&endpoint.includes('/releases?'))return this.releases.filter(r=>!r.created||!this.hideCreated).map(r=>structuredClone(r));
   if(method==='POST'&&endpoint==='repos/resokol/castlink/releases'){
    const r={id:42,tag_name:tag,target_commitish:commit,draft:true,prerelease:false,assets:[],created:true};this.releases.push(r);
    if(this.createLost){this.createLost=false;throw Error('Lost create response');}return structuredClone(r);
   }
   const asset=/\/releases\/assets\/(\d+)$/.exec(endpoint);
   if(method==='GET'&&asset)return Buffer.from(payload.get(Number(asset[1])));
   const upload=/\/releases\/(\d+)\/assets\?name=(.+)$/.exec(endpoint);
   if(method==='POST'&&upload){
    const release=this.releases.find(r=>r.id===Number(upload[1]));assert.ok(release);const name=decodeURIComponent(upload[2]);
    const local=verified.assets.find(a=>a.name===name),bytes=await fs.readFile(options.file);const id=++next;payload.set(id,bytes);
    release.assets.push({id,name,state:'uploaded',size:local.size,digest:'sha256:'+local.sha256,browser_download_url:`https://github.com/resokol/castlink/releases/download/${tag}/${name}`});
    if(this.uploadLost){this.uploadLost=false;throw Error('Lost upload response');}return structuredClone(release.assets.at(-1));
   }
   const numeric=/^repos\/resokol\/castlink\/releases\/(\d+)$/.exec(endpoint);
   if(numeric){const r=this.releases.find(r=>r.id===Number(numeric[1]));if(!r)throw Error('No numeric release');
    if(method==='PATCH'){Object.assign(r,options.body);if(this.publishLost){this.publishLost=false;throw Error('Lost publish response');}}
    return structuredClone(r);
   }
   throw Error('Unexpected API boundary: '+method+' '+endpoint);
  }};
 const options={directory,commit,version,receiptPath:path.join(root,'publication-receipt.json'),notes:'One-time local updater installation and preserved product updates.',api:fake,context,source:{head:commit,ref:'refs/heads/main',clean:true}};
 return {root,directory,fake,payload,verified,options,cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
const using=fn=>async()=>{const f=await fixture();try{await fn(f,await load());}finally{await f.cleanup();}};
test('publisher creates one draft then pins numeric ID without requiring collection visibility',using(async(f,{publishUpdater})=>{
 const result=await publishUpdater(f.options);assert.equal(result.releaseId,42);assert.equal(result.phase,'published');
 assert.equal(f.fake.calls.filter(c=>c.method==='POST'&&c.endpoint.endsWith('/releases')).length,1);
 const patch=f.fake.calls.find(c=>c.method==='PATCH');assert.equal(patch.body.make_latest,'false');assert.equal(patch.body.prerelease,false);
 assert.equal((await fs.readdir(f.directory)).length,8);assert.equal((await verifyUpdaterPackage({directory:f.directory,commit,version})).assets.length,8);
 assert.equal(f.fake.calls.filter(c=>c.endpoint.includes('/releases/assets/')).length,16);
}));
test('local corrupt package fails before any API mutation',using(async(f,{publishUpdater})=>{
 await fs.appendFile(path.join(f.directory,'castlink-updater.ps1'),'corrupt');await assert.rejects(publishUpdater(f.options),/hash|checksum|differ/i);
 assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('publication requires exact main source and successful full-source CI',using(async(f,{publishUpdater})=>{
 for(const source of [{head:'b'.repeat(40),ref:'refs/heads/main',clean:true},{head:commit,ref:'refs/heads/feature',clean:true},{head:commit,ref:'refs/heads/main',clean:false}])await assert.rejects(publishUpdater({...f.options,source}),/source|main|clean/i);
 f.fake.ci='failure';await assert.rejects(publishUpdater(f.options),/CI/i);assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('receipt must live outside immutable package',using(async(f,{publishUpdater})=>{
 await assert.rejects(publishUpdater({...f.options,receiptPath:path.join(f.directory,'receipt.json')}),/outside/i);assert.equal(f.fake.calls.length,0);
}));
test('lost create response never causes blind second POST; explicit numeric recovery works',using(async(f,{publishUpdater})=>{
 f.fake.createLost=true;await assert.rejects(publishUpdater(f.options),/Lost create/);
 await assert.rejects(publishUpdater(f.options),/uncertain|numeric/i);
 assert.equal(f.fake.calls.filter(c=>c.method==='POST'&&c.endpoint.endsWith('/releases')).length,1);
 const result=await publishUpdater({...f.options,resumeReleaseId:42});assert.equal(result.phase,'published');
}));
test('lost upload response resumes only matching draft assets without overwriting',using(async(f,{publishUpdater})=>{
 f.fake.uploadLost=true;await assert.rejects(publishUpdater(f.options),/Lost upload/);
 await publishUpdater(f.options);assert.equal(f.fake.calls.filter(c=>c.method==='POST'&&c.endpoint.includes('/assets?')).length,8);
}));
test('lost publication response resumes public release with readbacks only',using(async(f,{publishUpdater})=>{
 f.fake.publishLost=true;await assert.rejects(publishUpdater(f.options),/Lost publish/);const offset=f.fake.calls.length;
 assert.equal((await publishUpdater(f.options)).phase,'published');assert.ok(f.fake.calls.slice(offset).every(c=>c.method==='GET'));
}));
test('wrong numeric release identity, source or non-stable metadata blocks upload',using(async(f,{publishUpdater})=>{
 for(const change of [{id:43},{tag_name:'updater-v1.0.0-bbbbbbbbbbbb'},{target_commitish:'b'.repeat(40)},{prerelease:true}]){
  f.fake.releases=[{id:42,tag_name:tag,target_commitish:commit,draft:true,prerelease:false,assets:[],...change}];
  await assert.rejects(publishUpdater({...f.options,resumeReleaseId:42}),/identity|source|stable|numeric/i);
 }
 assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('existing public assets are immutable without an owned publication intent',using(async(f,{publishUpdater})=>{
 f.fake.releases=[{id:42,tag_name:tag,target_commitish:commit,draft:false,prerelease:false,assets:[]}];
 await assert.rejects(publishUpdater(f.options),/public|immutable/i);assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('wrong draft asset digest or unexpected inventory is never replaced',using(async(f,{publishUpdater})=>{
 for(const asset of [{id:100,name:'manifest.json',state:'uploaded',size:1,digest:'sha256:'+'0'.repeat(64)},{id:100,name:'foreign.exe',state:'uploaded',size:1,digest:'sha256:'+'0'.repeat(64)}]){
  f.fake.releases=[{id:42,tag_name:tag,target_commitish:commit,draft:true,prerelease:false,assets:[asset]}];
  await assert.rejects(publishUpdater(f.options),/asset|inventory|differ/i);
 }
 assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('remote bytes corruption with matching metadata prevents publication',using(async(f,{publishUpdater})=>{
 const request=f.fake.request.bind(f.fake);f.fake.request=async(method,endpoint,options)=>{
  const result=await request(method,endpoint,options);return endpoint.includes('/releases/assets/')?Buffer.from('corrupt bytes'):result;
 };
 await assert.rejects(publishUpdater(f.options),/remote|digest|bytes/i);assert.ok(!f.fake.calls.some(c=>c.method==='PATCH'));
}));
test('a pre-existing tag pointing at another full source is rejected before creating a draft',using(async(f,{publishUpdater})=>{
 const request=f.fake.request.bind(f.fake);f.fake.request=(method,endpoint,options)=>endpoint.includes('/git/ref/tags/')?{object:{type:'commit',sha:'b'.repeat(40)}}:request(method,endpoint,options);
 await assert.rejects(publishUpdater(f.options),/tag source/i);assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('an unpublished tag may be absent, while tag network failures never permit creation',using(async(f,{publishUpdater})=>{
 const request=f.fake.request.bind(f.fake);f.fake.request=async(method,endpoint,options)=>{
  if(endpoint.includes('/git/ref/tags/')&&!f.fake.releases.some(r=>r.draft===false)){const error=Error('Tag not created');error.status=404;throw error;}
  return request(method,endpoint,options);
 };
 assert.equal((await publishUpdater(f.options)).phase,'published');
}));
test('failed tag observation cannot masquerade as an absent new tag',using(async(f,{publishUpdater})=>{
 const request=f.fake.request.bind(f.fake);f.fake.request=(method,endpoint,options)=>{
  if(endpoint.includes('/git/ref/tags/'))throw Error('Network failed');return request(method,endpoint,options);
 };
 await assert.rejects(publishUpdater(f.options),/Network failed/);assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('an exact existing incomplete draft resumes without re-uploading its verified asset',using(async(f,{publishUpdater})=>{
 f.fake.releases=[{id:42,tag_name:tag,target_commitish:commit,draft:true,prerelease:false,assets:[]}];
 await f.fake.request('POST',`https://uploads.github.com/repos/resokol/castlink/releases/42/assets?name=LICENSE`,{file:path.join(f.directory,'LICENSE')});
 const start=f.fake.calls.length;assert.equal((await publishUpdater(f.options)).phase,'published');
 assert.equal(f.fake.calls.slice(start).filter(c=>c.method==='POST'&&c.endpoint.includes('/assets?')).length,7);
 assert.ok(!f.fake.calls.slice(start).some(c=>c.method==='DELETE'));
}));
test('an incomplete uploaded inventory cannot be published even when upload returns success',using(async(f,{publishUpdater})=>{
 const request=f.fake.request.bind(f.fake);f.fake.request=async(method,endpoint,options)=>{
  const result=await request(method,endpoint,options);if(method==='POST'&&endpoint.endsWith('/assets?name=manifest.json'))f.fake.releases[0].assets.pop();return result;
 };
 await assert.rejects(publishUpdater(f.options),/Incomplete remote/);assert.ok(!f.fake.calls.some(c=>c.method==='PATCH'));
}));
test('concurrent publishers cannot both create or modify the same publication intent',using(async(f,{publishUpdater})=>{
 const results=await Promise.allSettled([publishUpdater(f.options),publishUpdater(f.options)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(f.fake.calls.filter(c=>c.method==='POST'&&c.endpoint.endsWith('/releases')).length,1);
}));
test('workflow gates publication behind both platforms and retains recovery receipts on failure',async()=>{
 const workflow=await fs.readFile(new URL('../../.github/workflows/updater-package.yml',import.meta.url),'utf8').catch(()=>assert.fail('Updater workflow is not implemented'));
 assert.match(workflow,/pull_request:/);assert.match(workflow,/publish:[\s\S]*?type: boolean\s+default: false/);
 const publication=workflow.slice(workflow.indexOf('\n  publish:\n'));
 assert.match(publication,/needs: \[linux, windows\]/);assert.match(publication,/github\.ref == 'refs\/heads\/main'/);
 assert.equal((workflow.match(/contents: write/g)||[]).length,1);assert.match(publication,/contents: write/);
 assert.match(workflow,/persistent-updater-linux\.test\.py/);assert.match(workflow,/persistent-updater-windows\.fixtures\.ps1/);
 assert.match(publication,/if: \$\{\{ always\(\) \}\}/);assert.match(publication,/publication-receipt\.json/);
 assert.match(publication,/resume_run_id/);assert.match(publication,/CASTLINK_UPDATER_RESUME_RELEASE_ID/);
});

test('same stable updater version from another source is refused before create or resume',using(async(f,{publishUpdater})=>{
 const conflict={id:41,tag_name:'updater-v1.0.0-'+ 'b'.repeat(12),target_commitish:'b'.repeat(40),draft:false,prerelease:false,assets:[]};
 f.fake.releases=[conflict];
 await assert.rejects(publishUpdater(f.options),/version.*source|version.*identity/i);
 assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
 f.fake.releases.push({id:42,tag_name:tag,target_commitish:commit,draft:true,prerelease:false,assets:[]});
 await assert.rejects(publishUpdater({...f.options,resumeReleaseId:42}),/version.*source|version.*identity/i);
 assert.ok(!f.fake.calls.some(c=>c.method!=='GET'));
}));
test('conflicting version appearing during upload prevents promotion',using(async(f,{publishUpdater})=>{
 const request=f.fake.request.bind(f.fake);f.fake.request=async(method,endpoint,options)=>{
  const result=await request(method,endpoint,options);
  if(method==='POST'&&endpoint.includes('/assets?')&&!f.fake.releases.some(r=>r.id===41))f.fake.releases.push({id:41,tag_name:'updater-v1.0.0-'+ 'b'.repeat(12),draft:false,prerelease:false,assets:[]});
  return result;
 };
 await assert.rejects(publishUpdater(f.options),/version.*source|version.*identity/i);
 assert.ok(!f.fake.calls.some(c=>c.method==='PATCH'));
}));
