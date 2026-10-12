require('./i18n-fixture.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const vm=require('node:vm');
const filename=path.resolve(__dirname,'../components/StudioWorkspace.tsx');
const source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let initializer;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='startServerTransfer')initializer=node.initializer;ts.forEachChild(node,visit);}
visit(source);assert.ok(initializer,'planned transfer callback exists');
const code=ts.transpileModule(`const start = ${initializer.getText(source)}; start;`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 for(const credentials of [{sessionToken:'verified-primary-jwt',studioClientId:'actual-primary-client'},{sessionToken:undefined,studioClientId:'actual-primary-client'},{sessionToken:'verified-primary-jwt',studioClientId:''}]) {
  const calls=[],errors=[],handoffs=[];
  const context={...credentials,studioId:'studio',roomName:'my-room',transferTargetId:'reserve',transferBusy:false,AbortSignal,
   setTransferBusy:()=>{},setTransferError:error=>errors.push(error),setRestoreMessage:()=>{},
   sessionTransfer:{handoff:async result=>handoffs.push(result)},
   fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({ticket:'one-use',targetUrl:'https://reserve.example'})};},
  };
  await vm.runInNewContext(code,context)();
  if(credentials.sessionToken&&credentials.studioClientId){
   assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/server-transfer');
   assert.equal(calls[0].options.headers.authorization,'Bearer verified-primary-jwt');
   assert.equal(calls[0].options.headers['content-type'],'application/json');
   assert.deepEqual(JSON.parse(calls[0].options.body),{action:'start',studioId:'studio',room:'my-room',targetId:'reserve',clientId:'actual-primary-client'});
   assert.equal(handoffs.length,1);
  }else{assert.equal(calls.length,0,'missing studio JWT/clientId must not start transfer');assert.ok(errors.some(Boolean),'missing credentials shown to studio');}
 }
 console.log('PASS: actual Studio planned-transfer callback sends primary JWT/clientId and blocks missing credentials');
})().catch(error=>{console.error(error);process.exitCode=1});
