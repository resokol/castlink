import{test}from'node:test';import assert from'node:assert/strict';import{LocalExecutor}from'../dist/executors/local.js';import{sshInvocation}from'../dist/executors/ssh.js';
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
