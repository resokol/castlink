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
test('actual publisher pins source SHA in canonical repository and preserves legacy package metadata',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-destination-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const choice of [undefined,'primary']){
  const dir=path.join(root,choice||'default');fs.mkdirSync(dir);const source='a'.repeat(40),info=resolveTrack('client',source);
  for(const name of publisher.releaseFiles(info))if(name!=='SHA256SUMS')fs.writeFileSync(path.join(dir,name),name==='manifest.json'?JSON.stringify(info):'verified fixture '+name);
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  fs.writeFileSync(path.join(dir,'SHA256SUMS'),publisher.releaseFiles(info).filter(n=>n!=='SHA256SUMS').map(n=>hash(path.join(dir,n))+'  '+n).join('\n')+'\n');
  const before=fs.readFileSync(path.join(dir,'manifest.json')),calls=[],destination='resokol/castlink';let created=false;
  const fakeExec=(bin,args)=>{
   if(bin==='git')return args[0]==='rev-parse'?source:args[0]==='status'?'':'main';
   assert.equal(bin,'gh');calls.push(args);
   if(args[0]==='api'&&args[1]===`repos/${destination}`)return JSON.stringify(repo(destination));
   if(args[0]==='api'){
    assert.equal(args[1],`repos/${destination}/releases/tags/${info.tag}`);if(!created)throw Error('404');
    return JSON.stringify({tag_name:info.tag,draft:true,assets:publisher.verifyFiles(dir,info).map(f=>({name:f.name,state:'uploaded',size:fs.statSync(f.file).size,digest:f.digest}))});
   }
   if(args[1]==='create')created=true;return '';
  };
  const filename=require.resolve('../publish-release-track.cjs'),realRequire=createRequire(filename),module={exports:{}};
  const mockRequire=id=>id==='node:child_process'?{execFileSync:fakeExec}:realRequire(id);mockRequire.main=undefined;
  const env={CASTLINK_RELEASE_NOTES:'Verified fixture changes with explicit update instructions.',GITHUB_SHA:source,GITHUB_REF:'refs/heads/main'};
  if(choice)env.CASTLINK_RELEASE_DESTINATION=choice;
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:mockRequire,module,process:{env},console:{log(){}},__dirname:path.dirname(filename)});
  module.exports.publish('client',dir);
  const create=calls.find(a=>a[0]==='release'&&a[1]==='create');assert.ok(create);
  assert.equal(create[create.indexOf('--repo')+1],destination);assert.equal(create[create.indexOf('--target')+1],source);
  assert.deepEqual(fs.readFileSync(path.join(dir,'manifest.json')),before,'build provenance remains byte-identical');
  assert.equal(JSON.parse(before).repository,'resokol/castlink-releases','legacy updater alias stays unchanged across repository rename');
  const notes=fs.readFileSync(path.join(dir,'release-notes.md'),'utf8');assert.ok(notes.includes(`https://github.com/${destination}/blob/main/distribution/PRODUCTS.md`));
  assert.ok(notes.includes(`https://github.com/${destination}/blob/main/distribution/docs/en/PRODUCTS.md`));
  assert.ok(calls.find(a=>a[0]==='release'&&a[1]==='edit'&&a.includes('--draft=false')&&a.includes('--latest=false')));
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
