'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm'),{createRequire}=require('node:module');
const publisher=require('../publish-release-track.cjs'),{resolveTrack}=require('../release-track.cjs');
const repo=(name,privateRepo=false)=>({full_name:name,private:privateRepo,permissions:{push:true},default_branch:'main'});
test('publication has one canonical repository and accepts only the primary destination',()=>{
 assert.equal(publisher.releaseDestination(),'resokol/castlink');
 assert.equal(publisher.releaseDestination('primary'),'resokol/castlink');
 for(const choice of ['','public','private','resokol/castlink','resokol/studiolink','resokol/castlink-releases','someone/other'])assert.throws(()=>publisher.releaseDestination(choice),/destination/i);
});
test('publication requires the public canonical source repository',()=>{
 assert.doesNotThrow(()=>publisher.verifyDestination(repo('resokol/castlink')));
 assert.throws(()=>publisher.verifyDestination(repo('resokol/castlink',true)),/public|repository/i);
 for(const name of ['resokol/other','someone/castlink'])assert.throws(()=>publisher.verifyDestination(repo(name)),/destination|repository/i);
});
test('legacy updater alias and private archive cannot become publication destinations',()=>{
 for(const name of ['resokol/castlink-releases','resokol/studiolink'])for(const privacy of [false,true])assert.throws(()=>publisher.verifyDestination(repo(name,privacy)),/destination|repository/i);
 assert.throws(()=>publisher.verifyDestination(repo('resokol/castlink'),'public'),/destination/i);
});
test('destination checks reject missing write permissions and unverifiable repository metadata',()=>{
 const r=repo('resokol/castlink');
 assert.throws(()=>publisher.verifyDestination({...r,permissions:{push:false}}),/writ|destination|repository/i);
 assert.throws(()=>publisher.verifyDestination({...r,private:undefined}),/public|destination|repository/i);
 assert.throws(()=>publisher.verifyDestination({...r,default_branch:''}),/destination|repository/i);
});
test('actual publisher pins source SHA and package metadata in canonical repository',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-destination-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const choice of [undefined,'primary']){
  const dir=path.join(root,choice||'default');fs.mkdirSync(dir);const source='a'.repeat(40),info=resolveTrack('client',source);
  for(const name of publisher.releaseFiles(info))if(name!=='SHA256SUMS')fs.writeFileSync(path.join(dir,name),name==='manifest.json'?JSON.stringify(info):'verified fixture '+name);
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  fs.writeFileSync(path.join(dir,'SHA256SUMS'),publisher.releaseFiles(info).filter(n=>n!=='SHA256SUMS').map(n=>hash(path.join(dir,n))+'  '+n).join('\n')+'\n');
  const before=fs.readFileSync(path.join(dir,'manifest.json')),calls=[],destination='resokol/castlink';let draft;
  const fakeExec=(bin,args)=>{
   if(bin==='git')return args[0]==='rev-parse'?source:args[0]==='status'?'':'main';
   assert.equal(bin,'gh');calls.push(args);
   if(args[0]==='api'&&args[1]===`repos/${destination}`)return JSON.stringify(repo(destination));
   const endpoint=args[1],method=args.includes('--method')?args[args.indexOf('--method')+1]:'GET';
   if(endpoint===`repos/${destination}/releases?per_page=100`)return JSON.stringify([[]]);
   if(endpoint===`repos/${destination}/releases`&&method==='POST'){
    draft={id:123,tag_name:info.tag,draft:true,assets:[]};return JSON.stringify(draft);
   }
   if(endpoint===`repos/${destination}/releases/123`){
    if(method==='PATCH')draft.draft=false;return JSON.stringify(draft);
   }
   assert.equal(method,'POST');assert.ok(endpoint.startsWith(`https://uploads.github.com/repos/${destination}/releases/123/assets?name=`));
   const name=new URL(endpoint).searchParams.get('name'),file=publisher.verifyFiles(dir,info).find(f=>f.name===name);
   assert.equal(args[args.indexOf('--input')+1],file.file);
   draft.assets.push({name,state:'uploaded',size:fs.statSync(file.file).size,digest:file.digest});return JSON.stringify(draft.assets.at(-1));
  };
  const filename=require.resolve('../publish-release-track.cjs'),realRequire=createRequire(filename),module={exports:{}};
  const mockRequire=id=>id==='node:child_process'?{execFileSync:fakeExec}:realRequire(id);mockRequire.main=undefined;
  const env={CASTLINK_RELEASE_NOTES:'Verified fixture changes with explicit update instructions.',GITHUB_SHA:source,GITHUB_REF:'refs/heads/main'};
  if(choice)env.CASTLINK_RELEASE_DESTINATION=choice;
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:mockRequire,module,process:{env},console:{log(){}},__dirname:path.dirname(filename)});
  module.exports.publish('client',dir);
  const create=calls.find(a=>a[0]==='api'&&a[1]===`repos/${destination}/releases`&&a.includes('POST'));assert.ok(create);
  assert.ok(create.includes(`target_commitish=${source}`));assert.ok(create.includes(`tag_name=${info.tag}`));
  assert.deepEqual(fs.readFileSync(path.join(dir,'manifest.json')),before,'build provenance remains byte-identical');
  assert.equal(JSON.parse(before).repository,'resokol/castlink','new builds use canonical repository metadata');
  const notes=fs.readFileSync(path.join(dir,'release-notes.md'),'utf8');assert.ok(notes.includes(`https://github.com/${destination}/blob/main/distribution/PRODUCTS.md`));
  assert.ok(notes.includes(`https://github.com/${destination}/blob/main/distribution/docs/en/PRODUCTS.md`));
  assert.ok(calls.find(a=>a[0]==='api'&&a[1]===`repos/${destination}/releases/123`&&a.includes('PATCH')&&a.includes('draft=false')&&a.includes('make_latest=false')));
  for(const rejected of ['public','resokol/studiolink','someone/other']){env.CASTLINK_RELEASE_DESTINATION=rejected;const count=calls.length;assert.throws(()=>module.exports.publish('client',dir),/destination/i);assert.equal(calls.length,count,'override is rejected before any GitHub operation');}
 }
});
test('manual workflows retain build-only default, canonical credentials and D-based Windows pnpm setup',()=>{
 for(const name of ['windows-desktop-client.yml','easy-setup-packages.yml']){
  const s=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows',name),'utf8').replace(/\r\n/g,'\n');
  assert.match(s,/publish:\s*\n\s*description:[^\n]*\n\s*type: boolean\n\s*default: false/);
  assert.doesNotMatch(s,/release_destination:|CASTLINK_RELEASE_DESTINATION:|CASTLINK_RELEASES_TOKEN/);
  assert.match(s,/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(s,/permissions:\s*\n\s*contents: write/);
  if(name==='windows-desktop-client.yml')assert.match(s,/dest: 'D:\\GitHub\\CastLink-Internal\\cache\\pnpm-setup'/);
 }
});
