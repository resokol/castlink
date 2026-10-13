const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
const {randomUUID}=require('node:crypto'),{NextRequest}=require('next/server');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
test('operator registration rejects browser Origin, wrong token/installation, and scope broadening',async()=>{
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'castlink-operator-'));
 const token='x'.repeat(64),installationId=randomUUID(),peer={id:randomUUID(),installationId:randomUUID(),label:'Reserve',origin:'https://reserve.example.com',secret:'a'.repeat(64),scope:{kind:'room',roomId:randomUUID()}};
 process.env.STUDIOLINK_DATA_DIR=directory;process.env.STUDIOLINK_INSTALLATION_ID=installationId;process.env.CASTLINK_SETUP_TOKEN=token;
 const {POST}=require('../app/api/server-provisioning/operator/route.ts');
 const req=(changes={},headerChanges={})=>new NextRequest('http://127.0.0.1:3000/api/server-provisioning/operator',{method:'POST',headers:{'content-type':'application/json','x-castlink-profile-operator':token,...headerChanges},body:JSON.stringify({expectedInstallationId:installationId,peer,...changes})});
 try{
  assert.equal((await POST(req({}, {'x-castlink-profile-operator':'wrong-token'}))).status,401);
  assert.equal((await POST(req({}, {origin:'http://127.0.0.1:3000'}))).status,401);
  assert.equal((await POST(req({expectedInstallationId:randomUUID()}))).status,400);
  const response=await POST(req());assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  assert.equal((await POST(req({peer:{...peer,scope:{kind:'installation'}}}))).status,400);
  const saved=JSON.parse(await fsp.readFile(path.join(directory,'server-profiles.json'),'utf8'));
  assert.deepEqual(saved.peers[0].scope,peer.scope);
 }finally{await fsp.rm(directory,{recursive:true,force:true});}
});
