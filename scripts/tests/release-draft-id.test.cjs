'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm'),{createRequire}=require('node:module');
const publisher=require('../publish-release-track.cjs'),{resolveTrack}=require('../release-track.cjs');

function fixture(t,{existing=false,listError,wrongId=false,published=false,existingAsset}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-draft-id-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const source='a'.repeat(40),info=resolveTrack('client',source),calls=[],id=12345;
 for(const name of publisher.releaseFiles(info))if(name!=='SHA256SUMS')fs.writeFileSync(path.join(directory,name),name==='manifest.json'?JSON.stringify(info):'fixture '+name);
 fs.writeFileSync(path.join(directory,'SHA256SUMS'),publisher.releaseFiles(info).filter(n=>n!=='SHA256SUMS').map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,n))).digest('hex')+'  '+n).join('\n')+'\n');
 let draft={id,tag_name:info.tag,draft:!published,assets:[]};
 if(existingAsset){
  const file=publisher.verifyFiles(directory,info)[0];
  draft.assets.push({id:99,name:file.name,state:'uploaded',size:fs.statSync(file.file).size,digest:existingAsset==='valid'?file.digest:'sha256:'+'0'.repeat(64)});
 }
 const execute=(bin,args)=>{
  if(bin==='git')return args[0]==='rev-parse'?source:args[0]==='status'?'':'main';
  assert.equal(bin,'gh');calls.push(args);
  if(args[0]==='release'&&args[1]==='create')return '';
  const endpoint=args[1],method=args.includes('--method')?args[args.indexOf('--method')+1]:'GET';
  if(endpoint==='repos/resokol/castlink')return JSON.stringify({full_name:'resokol/castlink',private:false,permissions:{push:true},default_branch:'main'});
  if(endpoint.includes('/releases/tags/'))throw Error('HTTP 404: draft tags are not discoverable');
  if(endpoint==='repos/resokol/castlink/releases?per_page=100'){
   if(listError)throw Error(listError);
   return JSON.stringify([[],existing?[draft]:[]]);
  }
  if(endpoint==='repos/resokol/castlink/releases'&&method==='POST')return JSON.stringify({...draft,id:wrongId?'untrusted-id':id});
  if(endpoint===`repos/resokol/castlink/releases/${id}`){
   if(method==='PATCH')draft={...draft,draft:false};
   return JSON.stringify(draft);
  }
  if(endpoint.startsWith(`https://uploads.github.com/repos/resokol/castlink/releases/${id}/assets?name=`)&&method==='POST'){
   const name=new URL(endpoint).searchParams.get('name'),file=args[args.indexOf('--input')+1];
   assert.equal(file,path.join(directory,name));
   const asset={id:100+draft.assets.length,name,state:'uploaded',size:fs.statSync(file).size,digest:'sha256:'+crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
   draft.assets.push(asset);return JSON.stringify(asset);
  }
  throw Error('Unexpected CLI operation: '+JSON.stringify(args));
 };
 const filename=require.resolve('../publish-release-track.cjs'),realRequire=createRequire(filename),module={exports:{}};
 const mockRequire=id=>id==='node:child_process'?{execFileSync:execute}:realRequire(id);mockRequire.main=undefined;
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:mockRequire,module,process:{env:{GITHUB_SHA:source,GITHUB_REF:'refs/heads/main',CASTLINK_RELEASE_NOTES:'Verified changes and explicit update instructions.'}},console:{log(){}},__dirname:path.dirname(filename)});
 return {publish:()=>module.exports.publish('client',directory),calls,info,id,getDraft:()=>draft};
}

test('new draft publishes verified assets by numeric ID even when its tag endpoint returns 404',t=>{
 const f=fixture(t);f.publish();assert.equal(f.getDraft().draft,false);
 assert.equal(f.getDraft().assets.length,publisher.releaseFiles(f.info).length);
 assert.equal(f.calls.filter(a=>a[1]==='repos/resokol/castlink/releases'&&a.includes('POST')).length,1);
 assert.ok(f.calls.some(a=>a[1]===`repos/resokol/castlink/releases/${f.id}`&&a.includes('PATCH')));
 assert.equal(f.calls.some(a=>a[1]?.includes('/releases/tags/')),false);
});
test('existing draft on a later release-list page resumes without creating another release',t=>{
 const f=fixture(t,{existing:true});f.publish();assert.equal(f.getDraft().draft,false);
 assert.equal(f.calls.some(a=>a[1]==='repos/resokol/castlink/releases'&&a.includes('POST')),false);
});
test('authentication failure aborts without attempting draft creation or upload',t=>{
 const f=fixture(t,{listError:'HTTP 401: bad credentials'});assert.throws(f.publish,/401/);
 assert.equal(f.calls.some(a=>a.includes('POST')||a.includes('PATCH')),false);
});
test('unverifiable created release ID aborts before uploading or publishing',t=>{
 const f=fixture(t,{wrongId:true});assert.throws(f.publish,/Invalid draft release identity/);
 assert.equal(f.calls.some(a=>a[1]?.startsWith('https://uploads.')||a.includes('PATCH')),false);
});
test('published release stays immutable and receives no writes',t=>{
 const f=fixture(t,{existing:true,published:true});assert.throws(f.publish,/immutable/);
 assert.equal(f.calls.some(a=>a.includes('POST')||a.includes('PATCH')),false);
});
test('resume preserves an already verified draft asset and streams only missing files',t=>{
 const f=fixture(t,{existing:true,existingAsset:'valid'});f.publish();
 assert.equal(f.getDraft().assets.length,publisher.releaseFiles(f.info).length);
 assert.equal(f.calls.filter(a=>a[1]?.startsWith('https://uploads.')).length,publisher.releaseFiles(f.info).length-1);
});
test('different existing draft bytes abort before any upload or publication',t=>{
 const f=fixture(t,{existing:true,existingAsset:'mismatch'});assert.throws(f.publish,/Existing draft asset differs/);
 assert.equal(f.calls.some(a=>a.includes('POST')||a.includes('PATCH')),false);
});
