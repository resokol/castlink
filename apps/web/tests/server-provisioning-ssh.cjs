const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {generateKeyPairSync,createHash}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
test('SSH probe never authenticates; confirmed fingerprint gates password and command execution',async()=>{
 const {Server}=require('ssh2');
 const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem'});
 const server=new Server({hostKeys:[key]});let passwordAttempts=0;
 server.on('connection',connection=>{
  connection.on('error',()=>{});
  connection.on('authentication',ctx=>{if(ctx.method==='password'){passwordAttempts++;ctx.username==='root'&&ctx.password==='memory-only-secret'?ctx.accept():ctx.reject();}else ctx.reject();});
  connection.on('ready',()=>connection.on('session',(accept)=>accept().on('exec',(accept,reject,info)=>{const stream=accept();stream.write(info.command==='id -u'?'0\n':'fixed-result');stream.exit(0);stream.end();})));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 try{
  const ssh=require('../lib/server-provisioning-ssh.ts');
  const fingerprint=await ssh.probeSshFingerprint({host:'127.0.0.1',port});
  assert.match(fingerprint,/^SHA256:[A-Za-z0-9+/]+$/);
  assert.equal(passwordAttempts,0);
  await assert.rejects(ssh.openVerifiedSsh({host:'127.0.0.1',port,fingerprint:'SHA256:'+ 'A'.repeat(43),password:'memory-only-secret'}),/key|SSH/i);
  assert.equal(passwordAttempts,0);
  const client=await ssh.openVerifiedSsh({host:'127.0.0.1',port,fingerprint,password:'memory-only-secret'});
  assert.equal(await ssh.executeFixedSsh(client,'id -u','',1000),'0\n');
  client.end();assert.equal(passwordAttempts,1);
 }finally{await new Promise(r=>server.close(r));}
});
