import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-ubuntu-password-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const source=path.join(directory,'source'),bin=path.join(directory,'bin'),root=path.join(directory,'сервер с пробелами');
 fs.mkdirSync(path.join(source,'scripts'),{recursive:true});fs.mkdirSync(path.join(source,'infrastructure/production'),{recursive:true});fs.mkdirSync(bin);
 // Windows git archives may contain CRLF; execute the identical shell text as LF.
 const script=path.join(source,'scripts/install-ubuntu.sh');
 fs.writeFileSync(script,fs.readFileSync(path.join(repository,'scripts/install-ubuntu.sh'),'utf8').replace(/\r\n/g,'\n'));
 fs.copyFileSync(path.join(repository,'infrastructure/production/docker-compose.yml'),path.join(source,'infrastructure/production/docker-compose.yml'));
 for(const [command,body] of Object.entries({id:'echo 0',docker:'printf "%s\\n" "$*" >> "$FIXTURE_DOCKER_LOG"',openssl:'echo generated-secret-fixture',uuidgen:'echo 00000000-0000-4000-8000-000000000000'}))fs.writeFileSync(path.join(bin,command),'#!/bin/sh\n'+body+'\n',{mode:0o700});
 const log=path.join(directory,'docker.log'),env={...process.env,PATH:bin+path.delimiter+process.env.PATH,LC_ALL:'C',FIXTURE_DOCKER_LOG:log};
 const args=[script,'--image','example.test/web@sha256:'+'a'.repeat(64),'--root',root];
 return {directory,root,env,args,run(extra=[],options={}){return spawnSync('bash',[...args,...extra],{env,encoding:'utf8',timeout:20000,...options});},file(value){const file=path.join(directory,'chosen-password');fs.writeFileSync(file,value,{mode:0o600});return file;},web(){return fs.readFileSync(path.join(root,'infrastructure/production/web.env'),'utf8');},log(){return fs.readFileSync(log,'utf8');}};
}

test('real fresh installer stores only the exact UTF-8 password hash from a private input file',t=>{
 const f=fixture(t),password=' Пароль $ # " \\ 🔒 ';
 const result=f.run(['--room-creation-password-file',f.file(password)]);
 assert.equal(result.status,0,result.stderr);
 assert.match(f.web(),new RegExp('^ROOM_CREATION_PASSWORD_SHA256='+hash(password)+'$','m'));
 for(const file of ['infrastructure/production/web.env','install-state.json','setup-token.txt','.castlink-release'])assert.ok(!fs.readFileSync(path.join(f.root,file),'utf8').includes(password),file);
 assert.ok(!(result.stdout+result.stderr+f.log()).includes(password));
 assert.equal(fs.statSync(path.join(f.root,'infrastructure/production/web.env')).mode&0o777,0o600);
 assert.equal(f.log().trim(),'compose version','fixture must never deploy or contact real Docker');
});

test('Unicode boundaries match web and Windows UTF-16 length independent of host locale',t=>{
 for(const password of ['пароль12','я'.repeat(256),'🔒'.repeat(4),'🔒'.repeat(128)]){
  const f=fixture(t),result=f.run(['--room-creation-password-file',f.file(password)]);
  assert.equal(result.status,0,result.stderr);assert.ok(f.web().includes('ROOM_CREATION_PASSWORD_SHA256='+hash(password)));
 }
});

test('invalid UTF-8, size, whitespace and line/control delimiters fail before installation writes',t=>{
 for(const password of ['short','🔒'.repeat(3),'🔒'.repeat(129),'я'.repeat(257),' '.repeat(8),'valid\npassword','valid\rpassword','valid\0password',Buffer.from([0xff,0xfe]),Buffer.alloc(1025,97)]){
  const f=fixture(t),result=f.run(['--room-creation-password-file',f.file(password)]);
  assert.notEqual(result.status,0);assert.equal(fs.existsSync(f.root),false,'invalid input must not leave partial installation');
  if(typeof password==='string')assert.ok(!(result.stdout+result.stderr).includes(password));
 }
 const f=fixture(t),result=f.run(['--room-creation-password-file',path.join(f.directory,'missing')]);
 assert.notEqual(result.status,0);assert.equal(fs.existsSync(f.root),false);
});

test('noninteractive install requires explicit password input and preserves existing data on retry',t=>{
 const f=fixture(t),missing=f.run();assert.notEqual(missing.status,0);assert.equal(fs.existsSync(f.root),false);
 const input=f.file('chosen-password');assert.equal(f.run(['--room-creation-password-file',input]).status,0);
 const before=f.web();assert.notEqual(f.run().status,0);assert.equal(f.web(),before);
 const preserved=fixture(t),credential=path.join(preserved.root,'data/runtime/room-creation-password.json');
 fs.mkdirSync(path.dirname(credential),{recursive:true});const original='{"version":1,"hash":"'+'b'.repeat(64)+'"}\n';fs.writeFileSync(credential,original);
 assert.notEqual(preserved.run(['--room-creation-password-file',preserved.file('different-password')]).status,0);
 assert.equal(fs.readFileSync(credential,'utf8'),original);assert.equal(fs.existsSync(path.join(preserved.root,'infrastructure/production/web.env')),false);
});

const terminalHarness=String.raw`
import os,pty,select,sys,json,time
with open(sys.argv[1],encoding='utf8') as source: data=json.load(source)
pid,master=pty.fork()
if pid==0: os.execvpe('bash',['bash']+data['args'],os.environ)
output=b'';stage=0;deadline=time.monotonic()+15
prompts=[b'Room creation password (8-256 characters): ',b'Confirm room creation password: ']
while time.monotonic()<deadline:
 if select.select([master],[],[],0.1)[0]:
  try: chunk=os.read(master,65536)
  except OSError: break
  if not chunk: break
  output+=chunk
  if stage<2 and prompts[stage] in output:
   os.write(master,data['answers'][stage].encode('utf8')+b'\n');stage+=1
 else:
  done,status=os.waitpid(pid,os.WNOHANG)
  if done: print(json.dumps({'status':os.waitstatus_to_exitcode(status),'output':output.decode('utf8',errors='replace'),'prompts':stage}));sys.exit(0)
done,status=os.waitpid(pid,os.WNOHANG)
if not done:
 os.kill(pid,9);os.waitpid(pid,0);raise RuntimeError('Installer terminal timed out')
print(json.dumps({'status':os.waitstatus_to_exitcode(status),'output':output.decode('utf8',errors='replace'),'prompts':stage}))
`;
test('real interactive installer hides and confirms the chosen password; mismatch writes nothing',t=>{
 for(const mismatch of [false,true]){
  const f=fixture(t),password='Выбранный 🔒 пароль',input=path.join(f.directory,'terminal-input.json');
  fs.writeFileSync(input,JSON.stringify({args:f.args,answers:[password,mismatch?'different-password':password]}),{mode:0o600});
  const result=spawnSync('python3',['-c',terminalHarness,input],{env:f.env,encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stderr);const terminal=JSON.parse(result.stdout);
  assert.equal(terminal.prompts,2);assert.ok(!terminal.output.includes(password),'terminal must never echo plaintext');
  if(mismatch){assert.notEqual(terminal.status,0);assert.equal(fs.existsSync(f.root),false);}
  else{assert.equal(terminal.status,0,terminal.output);assert.ok(f.web().includes('ROOM_CREATION_PASSWORD_SHA256='+hash(password)));}
 }
});
