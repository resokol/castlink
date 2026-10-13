const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {maintenanceResponse}=require('../lib/update-maintenance.ts');
test('maintenance blocks writes, tokens and transfer admission until the local marker is removed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-maintenance-')),marker=path.join(dir,'marker');
 try{
  assert.equal(maintenanceResponse('POST','/api/rooms',marker),null);fs.writeFileSync(marker,'update');
  for(const [method,url] of [['POST','/api/rooms'],['GET','/api/token'],['POST','/api/server-transfer'],['GET','/api/media-admission'],['POST','/api/version']]){
   const r=maintenanceResponse(method,url,marker);assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Retry-After'),'10');
  }
  assert.equal(maintenanceResponse('GET','/api/version',marker),null);
  fs.unlinkSync(marker);assert.equal(maintenanceResponse('POST','/api/rooms',marker),null);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unexpected marker lookup errors fail closed and cannot expose filesystem details',async()=>{
 const r=maintenanceResponse('POST','/api/token','invalid\0path');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/invalid|path|ENOENT|EACCES/);
});
