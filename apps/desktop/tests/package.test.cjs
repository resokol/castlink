const { test } = require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {isPackageFile,stagePackage,artifactNames}=require('../scripts/package-files.cjs');
test('artifact names preserve the builder extension macro literally',()=>{
  const names=artifactNames('1.0.0-rc.3','a'.repeat(40));
  assert.equal(names.portable,'CastLink-Client-1.0.0-rc.3-aaaaaaaaaaaa-win-x64.${ext}');
  assert.equal(names.unified,'CastLink-1.0.0-rc.3-aaaaaaaaaaaa-Windows.exe');
  assert.equal(names.installer,'CastLink-Client-1.0.0-rc.3-aaaaaaaaaaaa-setup.exe');
});
test('package allowlist excludes web sources, secrets, maps, QA and nested dependencies',()=>{
  for(const file of ['src/main.cjs','src/preload.cjs','ui/start.html','ui/start.js','ui/start.css','assets/castlink-icon.svg','assets/castlink-icon.ico'])assert.equal(isPackageFile(file),true,file);
  for(const file of ['.env','src/.env','ui/a.js.map','src/dev.ts','tests/a.test.cjs','apps/web/app/page.tsx','node_modules/x/index.js','src/../../.env','src/nested/test.cjs','ui/token.json'])assert.equal(isPackageFile(file),false,file);
});
test('staging uses the independent client version and copies only explicit runtime files',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-stage-test-'));const dest=path.join(root,'stage');
  try{
    for(const [file,text]of Object.entries({'package.json':JSON.stringify({version:'1.0.0-rc.3',buildNumber:'776AF9'}),'LICENSE':'CastLink license','THIRD_PARTY_NOTICES':'Third party notices','apps/desktop/package.json':JSON.stringify({name:'@castlink/desktop',main:'src/main.cjs',devDependencies:{electron:'44.9.0'}}),'apps/desktop/src/main.cjs':'runtime','apps/desktop/ui/start.html':'UI','apps/desktop/assets/castlink-icon.svg':'icon','apps/desktop/.env':'secret','apps/desktop/ui/start.js.map':'private source map'})){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);}
    fs.mkdirSync(path.join(root,'distribution'),{recursive:true});
    fs.copyFileSync(path.resolve(__dirname,'../../../distribution/release-tracks.json'),path.join(root,'distribution/release-tracks.json'));
    const result=stagePackage(root,dest,'a'.repeat(40));assert.equal(result.version,'1.0.0-rc.8');assert.equal(result.sourceCommit,'a'.repeat(40));assert.equal(result.track,'client');assert.equal(result.buildNumber,'1.0.0-rc.8-aaaaaaaaaaaa');
    const manifest=JSON.parse(fs.readFileSync(path.join(dest,'package.json')));assert.equal(manifest.version,'1.0.0-rc.8');assert.equal(manifest.devDependencies,undefined);
    assert.equal(fs.readFileSync(path.join(dest,'src/main.cjs'),'utf8'),'runtime');assert.equal(fs.existsSync(path.join(dest,'.env')),false);assert.equal(fs.existsSync(path.join(dest,'ui/start.js.map')),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

