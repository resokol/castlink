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
  await assert.rejects(ssh.openVerifiedSsh({host:'127.0.0.1',port,fingerprint,password:'wrong-memory-only-secret'}),error=>error.code==='ssh-authentication-failed'&&!error.message.includes('wrong-memory-only-secret'));
  const client=await ssh.openVerifiedSsh({host:'127.0.0.1',port,fingerprint,password:'memory-only-secret'});
  assert.equal(await ssh.executeFixedSsh(client,'id -u','',1000),'0\n');
  client.end();assert.equal(passwordAttempts,2);
 }finally{await new Promise(r=>server.close(r));}
});
test('private-key authentication supports encrypted PEM and OpenSSH, rejects malformed keys and never bypasses host trust',async()=>{
 const {Server,utils}=require('ssh2'),{spawnSync}=require('node:child_process'),os=require('node:os'),path=require('node:path');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-ssh-keys-'));
 const encrypted=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem',cipher:'aes-256-cbc',passphrase:'fixture-key-passphrase'}).toString();
 const result=spawnSync('ssh-keygen',['-q','-t','ed25519','-N','fixture-key-passphrase','-f',path.join(directory,'id')]);assert.equal(result.status,0);
 const openssh=fs.readFileSync(path.join(directory,'id'),'utf8');
 const parsedKeys=[encrypted,openssh].map(key=>{const parsed=utils.parseKey(key,'fixture-key-passphrase');return Array.isArray(parsed)?parsed[0]:parsed;});
 const hostKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem'});
 const server=new Server({hostKeys:[hostKey]});let keyAttempts=0,passwordAttempts=0;
 server.on('connection',connection=>{
  connection.on('error',()=>{});
  connection.on('authentication',ctx=>{
   if(ctx.method==='password'){passwordAttempts++;return ctx.reject();}
   if(ctx.method!=='publickey')return ctx.reject();keyAttempts++;
   const key=parsedKeys.find(key=>key.getPublicSSH().equals(ctx.key.data));
   if(ctx.username==='root'&&key&&(!ctx.signature||key.verify(ctx.blob,ctx.signature,ctx.hashAlgo)))ctx.accept();else ctx.reject();
  });
  connection.on('ready',()=>connection.on('session',accept=>accept().on('exec',accept=>{const stream=accept();stream.write('0\n');stream.exit(0);stream.end();})));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  const ssh=require('../lib/server-provisioning-ssh.ts'),fingerprint=await ssh.probeSshFingerprint({host:'127.0.0.1',port});
  for(const privateKey of [encrypted,openssh]){
   await assert.rejects(ssh.openVerifiedSsh({host:'127.0.0.1',port,fingerprint:'SHA256:'+'A'.repeat(43),authType:'private-key',privateKey,passphrase:'fixture-key-passphrase',password:'must-not-fallback'}),/SSH/);
   assert.equal(keyAttempts,privateKey===encrypted?0:2);
   const client=await ssh.openVerifiedSsh({host:'127.0.0.1',port,fingerprint,authType:'private-key',privateKey,passphrase:'fixture-key-passphrase',password:'must-not-fallback'});client.end();
  }
  assert.equal(passwordAttempts,0);assert.equal(keyAttempts,4);
  for(const privateKey of ['MALFORMED-SECRET',encrypted,openssh,'x'.repeat(65537), '密'.repeat(30000)]){
   await assert.rejects(ssh.openVerifiedSsh({host:'127.0.0.1',port,fingerprint,authType:'private-key',privateKey,passphrase:'wrong-key-passphrase'}),error=>error.code==='ssh-private-key-invalid'&&!error.message.includes('MALFORMED-SECRET')&&!error.message.includes('wrong-key-passphrase'));
  }
  assert.equal(keyAttempts,4);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});}
});
test('generated RSA3072 pair matches; mixed pairs are refused before authorization',async()=>{
 const {utils}=require('ssh2'),ssh=require('../lib/server-provisioning-ssh.ts');
 const pair=await ssh.generateSshKeyPair();assert.match(pair.privateKey,/BEGIN RSA PRIVATE KEY/);assert.match(pair.publicKey,/^ssh-rsa [A-Za-z0-9+/]+={0,2}$/);
 ssh.validateSshKeyPair(pair.publicKey,pair.privateKey);
 const parsed=utils.parseKey(pair.privateKey);assert.equal(require('node:crypto').createPrivateKey(pair.privateKey).asymmetricKeyDetails.modulusLength,3072);assert.equal(parsed.isPrivateKey(),true);
 const other=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem'}).toString();
 assert.throws(()=>ssh.validateSshKeyPair(pair.publicKey,other),/Некорректная пара/);
});
