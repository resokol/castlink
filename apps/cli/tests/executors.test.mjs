import{test}from'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{LocalExecutor}from'../dist/executors/local.js';import{sshInvocation,SshExecutor}from'../dist/executors/ssh.js';
test('process arguments with spaces, Unicode and shell syntax remain literal',async()=>{
 const e=new LocalExecutor();const arg='данные $(echo exposed); space';const r=await e.run({executable:process.execPath,args:['-e','process.stdout.write(process.argv[1])',arg],sensitive:false});assert.equal(r.code,0);assert.equal(r.stdout,arg);
});
test('missing executables produce a precise runtime blocker',async()=>{await assert.rejects(new LocalExecutor().run({executable:'castlink-not-an-installed-executable',args:[],sensitive:false}),error=>error.code===3);});
test('timeout terminates the child and returns a blocker',async()=>{await assert.rejects(new LocalExecutor(50).run({executable:process.execPath,args:['-e','setTimeout(()=>{},5000)'],sensitive:false}),error=>error.code===3);});
test('SSH uses strict host-key verification and stdin instead of secret arguments',()=>{
 const target={kind:'remote',host:'203.0.113.8',user:'operator',port:2222};const r=sshInvocation(target,{executable:'docker',args:['compose','-f','/opt/CastLink тест/compose.yml','config'],input:Buffer.from('secret-fixture'),sensitive:true});
 assert.ok(r.args.includes('StrictHostKeyChecking=yes'));assert.ok(r.args.includes('BatchMode=yes'));assert.doesNotMatch(r.args.join(' '),/secret-fixture|\/opt\/CastLink/);assert.match(Buffer.from(r.input).toString(),/secret-fixture/);assert.equal(r.args[r.args.length-2],target.host);
 assert.throws(()=>sshInvocation({...target,host:'-oProxyCommand=echo'}, {executable:'id',args:[],sensitive:false}),/target/i);
});

test('process output preserves UTF-8 characters split between chunks',async()=>{
 const script='process.stdout.write(Buffer.from([0xd0])); setTimeout(()=>process.stdout.write(Buffer.from([0xb0])),100)';
 const result=await new LocalExecutor().run({executable:process.execPath,args:['-e',script],sensitive:false});assert.equal(result.stdout,'а');
});
function actualHelperTransport(local=new LocalExecutor()){
 return{run:async invocation=>{
  assert.equal(invocation.executable,'ssh');
  const command=invocation.args.at(-1),prefix="python3 -c '";
  assert.ok(command.startsWith(prefix)&&command.endsWith("'"));
  const helper=command.slice(prefix.length,-1).replaceAll("'\\''","'");
  return local.run({executable:'python3',args:['-c',helper],input:invocation.input,sensitive:invocation.sensitive});
 }};
}
const helperTarget={kind:'remote',host:'fixture.example',user:'deploy',port:22};
for(const newline of ['\r\n','\r'])test(`actual SSH Python helper preserves ${newline==='\r'?'lone CR':'CRLF'} and nonASCII stdout stderr stdin bytes`,async()=>{
 const executor=new SshExecutor(helperTarget,actualHelperTransport());
 const raw='{'+newline+'"annotation":"Привет 世界"'+newline+'}';
 {
  const request={executable:'python3',args:['-c','import sys; b=sys.stdin.buffer.read(); sys.stdout.buffer.write(b); sys.stderr.buffer.write(b); sys.exit(7)'],input:Buffer.from(raw),sensitive:true};
  const expected=await new LocalExecutor().run(request),observed=await executor.run(request);
  assert.equal(observed.code,7);assert.deepEqual(observed,expected);
  for(const channel of ['stdout','stderr'])assert.equal(createHash('sha256').update(observed[channel]).digest('hex'),createHash('sha256').update(raw).digest('hex'));
 }
});
test('actual helper transport retains output caps and fixed invalid-process errors',async()=>{
 const executor=new SshExecutor(helperTarget,actualHelperTransport());
 await assert.rejects(executor.run({executable:'python3',args:['-c','import sys; sys.stdout.buffer.write(b"x"*1048577)'],sensitive:false}),e=>e.code===1&&!/1048577|python|secret-fixture/.test(e.message));
 await assert.rejects(executor.run({executable:'not-allowed-secret-fixture',args:[],sensitive:false}),e=>e.code===3&&!/secret-fixture|Traceback/.test(e.message));
 await assert.rejects(executor.run({executable:'python3',args:['-c','import sys; sys.stdout.buffer.write(b"secret-fixture\\xff")'],sensitive:false}),e=>e.code===3&&!/secret-fixture|UnicodeDecodeError|Traceback/.test(e.message));
});
