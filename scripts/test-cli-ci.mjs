#!/usr/bin/env node
// CI-only execution partition. Production UID/ownership guards are unchanged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const legacyFiles=Object.freeze(['private-control-config.test.mjs','private-control-services.test.mjs','private-control-setup.test.mjs']);
const script=fileURLToPath(import.meta.url),root=path.dirname(path.dirname(script)),cli=path.join(root,'apps/cli');
const phases=new Set(['arguments','host-identity','ci-mode','node-staging','closure-staging','node-admission','partition','closure','sudo-admission','setpriv-admission','env-admission','actor-identity','actor-node-owner','actor-private-directory','common-tests','legacy-tests']);
const reasons=new Set(['unsupported-input','path-not-canonical','path-symlink','executable-not-file','executable-hardlink','executable-writable','executable-not-executable','executable-owner','ancestor-not-directory','ancestor-owner','ancestor-writable','closure-not-file','closure-unexpected-entry','closure-import','closure-size','closure-copy','actor-node-owner','actor-private-directory']);
let currentPhase='arguments';
class AdmissionError extends Error {constructor(reason){super('CLI CI admission refused.');this.reason=reasons.has(reason)?reason:'unsupported-input';}}
function fail(reason='unsupported-input'){throw new AdmissionError(reason);}
export function admissionDiagnostic(error,phase){
 const reason=error instanceof AdmissionError&&Object.getPrototypeOf(error)===AdmissionError.prototype&&reasons.has(error.reason)?error.reason:
  error?.code==='ENOENT'?'io-missing':error?.code==='EACCES'||error?.code==='EPERM'?'io-permission':error?.code==='ELOOP'?'io-symlink':error?.code==='ENOTDIR'?'io-not-directory':'io-other';
 return{schemaVersion:1,phase:phases.has(phase)?phase:'unknown',reason};
}
function finiteId(v){return Number.isSafeInteger(v)&&v>=0&&v<=0xffffffff;}
const nodeLimit=256*1024**2;
function sameFile(a,b){return ['dev','ino','size','mtimeMs','ctimeMs','uid','mode','nlink'].every(k=>a[k]===b[k]);}
function copyRunningNode(output=null){
 if(process.platform!=='linux')fail();
 // This fixed kernel link identifies the executable ALREADY running under setup-node.
 // It is not a caller filename, new publisher assertion or production package authority.
 const source=fs.openSync('/proc/self/exe',fs.constants.O_RDONLY),hash=createHash('sha256');
 try{
  const before=fs.fstatSync(source);if(!before.isFile()||before.size<=0||before.size>nodeLimit)fail();
  const buffer=Buffer.alloc(65536);let total=0;
  while(total<=before.size){const n=fs.readSync(source,buffer,0,Math.min(buffer.length,before.size+1-total),total);if(!n)break;if(total+n>before.size)fail();hash.update(buffer.subarray(0,n));if(output!==null){let written=0;while(written<n){const count=fs.writeSync(output,buffer,written,n-written,total+written);if(!count)fail();written+=count;}}total+=n;}
  if(total!==before.size||!sameFile(before,fs.fstatSync(source)))fail();
  return{sha256:hash.digest('hex'),size:before.size};
 }finally{fs.closeSync(source);}
}
export function runningNodeSha256(){return copyRunningNode().sha256;}
export function stageRunningNode(parent=os.tmpdir()){
 canonical(parent);const ps=fs.lstatSync(parent),uid=process.getuid?.();
 const rootSticky=ps.uid===0&&(ps.mode&0o1000)!==0;
 if(!finiteId(uid)||!ps.isDirectory()||ps.uid!==uid&&!rootSticky||((ps.mode&0o022)!==0&&!rootSticky))fail();
 const directory=fs.mkdtempSync(path.join(parent,'castlink-ci-node-')),node=path.join(directory,'node');let fd;
 try{
  const ds=fs.lstatSync(directory);if(ds.uid!==uid||(ds.mode&0o777)!==0o700)fail();
  fd=fs.openSync(node,fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o500);
  const copied=copyRunningNode(fd);fs.fsyncSync(fd);
  const before=fs.fstatSync(fd),hash=createHash('sha256'),buffer=Buffer.alloc(65536);let read=0;
  while(read<copied.size){const n=fs.readSync(fd,buffer,0,Math.min(buffer.length,copied.size-read),read);if(!n)fail();hash.update(buffer.subarray(0,n));read+=n;}
  if(before.size!==copied.size||before.uid!==uid||before.nlink!==1||!sameFile(before,fs.fstatSync(fd))||!sameFile(before,fs.lstatSync(node))||hash.digest('hex')!==copied.sha256)fail();
  // Only public executable bytes are shared. Other actors can traverse, never list/write.
  // Secret actor HOME/TMP remains a different independently checked mode700 directory.
  fs.fchmodSync(fd,0o555);fs.chmodSync(directory,0o711);admitExecutable(node);
  return{directory,node,sha256:copied.sha256,dispose:()=>fs.rmSync(directory,{recursive:true,force:true})};
 }catch(error){fs.rmSync(directory,{recursive:true,force:true});throw error;}finally{if(fd!==undefined)fs.closeSync(fd);}
}
export function requireActorIdentity(uid,gid){if(!finiteId(uid)||!finiteId(gid)||uid!==1000||gid!==1000)fail();return{uid,gid};}
export function partitionCliTests(files,isolated){
 if(!Array.isArray(files)||files.some(n=>typeof n!=='string'||! /^[a-zA-Z0-9_-]+\.test\.mjs$/.test(n))||new Set(files).size!==files.length||legacyFiles.some(n=>!files.includes(n)))fail();
 return{common:files.filter(n=>!isolated||!legacyFiles.includes(n)).toSorted(),legacy:isolated?[...legacyFiles]:[]};
}
export function identityCommand(node,entry,identity,nodeOwner=identity.uid){
 if(!path.isAbsolute(node)||!path.isAbsolute(entry)||!finiteId(identity.uid)||!finiteId(identity.gid)||!finiteId(nodeOwner))fail();
 return identity.uid===1000&&identity.gid===1000?{executable:node,args:[entry,'--legacy-private-control-actor']}:{executable:'/usr/bin/sudo',args:['-n','--','/usr/bin/setpriv','--reuid=1000','--regid=1000','--clear-groups','--','/usr/bin/env','-i',...Object.entries(actorEnvironment(node,nodeOwner)).map(([k,v])=>k+'='+v),node,entry,'--legacy-private-control-actor']};
}
export function actorEnvironment(node,owner=process.getuid()){if(!path.isAbsolute(node)||!finiteId(owner))fail();return{PATH:path.dirname(node),LANG:'C.UTF-8',CI:'true',GITHUB_ACTIONS:'true',CASTLINK_CI_FIXED_ACTOR:'1',CASTLINK_CI_NODE_UID:String(owner)};}
export function suiteResult(common,legacy){return common===0&&legacy===0?0:1;}
function canonical(file){if(!path.isAbsolute(file)||fs.realpathSync(file)!==file)fail('path-not-canonical');for(let p=file;;p=path.dirname(p)){if(fs.lstatSync(p).isSymbolicLink())fail('path-symlink');if(path.dirname(p)===p)break;}return file;}
export function admitExecutable(file,system=false,recordedOwner=null){
 if(recordedOwner!==null&&!finiteId(recordedOwner))fail();canonical(file);const s=fs.lstatSync(file);
 if(!s.isFile())fail('executable-not-file');if(s.nlink!==1)fail('executable-hardlink');if(s.mode&0o022)fail('executable-writable');if(!(s.mode&0o111))fail('executable-not-executable');if(system?s.uid!==0:s.uid!==0&&s.uid!==process.getuid()&&s.uid!==recordedOwner)fail('executable-owner');
 if(system)for(let p=path.dirname(file);;p=path.dirname(p)){const a=fs.lstatSync(p);if(!a.isDirectory())fail('ancestor-not-directory');if(a.uid!==0)fail('ancestor-owner');if(a.mode&0o022)fail('ancestor-writable');if(path.dirname(p)===p)break;}
 fs.accessSync(file,fs.constants.R_OK|fs.constants.X_OK);return file;
}
function readable(file){canonical(file);if(!fs.lstatSync(file).isFile())fail('closure-not-file');fs.accessSync(file,fs.constants.R_OK);}
export function checkCliClosure(repository=root){
 const checkedCli=path.join(repository,'apps/cli');
 readable(path.join(repository,'scripts/test-cli-ci.mjs'));readable(path.join(checkedCli,'package.json'));for(const n of legacyFiles)readable(path.join(checkedCli,'tests',n));
 for(const n of ['private-control-fixture.mjs','private-control-services-fixture.mjs'])readable(path.join(checkedCli,'tests',n));
 function walk(dir){canonical(dir);for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.isFile()&&e.name.endsWith('.js'))readable(f);else fail('closure-unexpected-entry');}}
 walk(path.join(checkedCli,'dist'));readable(path.join(checkedCli,'dist/config-target.js'));readable(path.join(checkedCli,'dist/service-target-runner.js'));readable(path.join(checkedCli,'dist/setup.js'));
}
// Ignore quoted/generated target programs: their imports execute inside containers.
function actorCodeImports(text){
 const result=[...text.matchAll(/^import\s+(?:[^;\n]*?\s+from\s*)?['"]([^'"]+)['"]/gm)].map(m=>m[1]);
 for(let at=0;at<text.length;){
  if(text.startsWith('//',at)){const end=text.indexOf('\n',at+2);at=end<0?text.length:end+1;continue;}
  if(text.startsWith('/*',at)){const end=text.indexOf('*/',at+2);if(end<0)fail('closure-import');at=end+2;continue;}
  if(['"',"'",'`'].includes(text[at])){const quote=text[at++];while(at<text.length){const c=text[at++];if(c==='\\')at++;else if(c===quote)break;}continue;}
  if(text.startsWith('import',at)&&!/[\w$]/.test(text[at-1]??'')){
   const rest=text.slice(at),m=rest.match(/^import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
   if(m){result.push(m[1]);at+=m[0].length;continue;}if(/^import\s*\(/.test(rest))fail('closure-import');
  }
  at++;
 }
 return result;
}
// Fixed public code only: never copy node_modules, configuration, environment or data.
export function stageActorClosure(repository=root,parent=os.tmpdir()){
 checkCliClosure(repository);canonical(parent);const uid=process.getuid(),ps=fs.lstatSync(parent),sticky=ps.uid===0&&(ps.mode&0o1000)!==0;
 if(!ps.isDirectory()||ps.uid!==uid&&!sticky||(ps.mode&0o022)!==0&&!sticky)fail();
 const files=['scripts/test-cli-ci.mjs','apps/cli/package.json',...legacyFiles.map(n=>'apps/cli/tests/'+n),...['private-control-fixture.mjs','private-control-services-fixture.mjs'].map(n=>'apps/cli/tests/'+n)];
 function outputs(dir){for(const e of fs.readdirSync(path.join(repository,dir),{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())outputs(file);else if(e.isFile()&&e.name.endsWith('.js'))files.push(file);else fail('closure-unexpected-entry');}}
 outputs('apps/cli/dist');files.sort();if(files.length>256)fail('closure-size');
 const directory=fs.mkdtempSync(path.join(parent,'castlink-ci-actor-code-')),hashes={};let total=0;
 try{
  for(const relative of files){
   const source=path.join(repository,relative);canonical(source);const named=fs.lstatSync(source),fd=fs.openSync(source,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let data;
   try{const before=fs.fstatSync(fd);if(!before.isFile()||before.size>8*1024**2||!sameFile(named,before))fail('closure-copy');data=fs.readFileSync(fd);if(data.length!==before.size||!sameFile(before,fs.fstatSync(fd))||!sameFile(before,fs.lstatSync(source)))fail('closure-copy');}finally{fs.closeSync(fd);}
   total+=data.length;if(total>32*1024**2)fail('closure-size');
   if(relative.endsWith('.js')||relative.endsWith('.mjs')){
    const text=data.toString('utf8');if(!Buffer.from(text).equals(data))fail('closure-import');
    for(const spec of actorCodeImports(text)){if(spec.startsWith('node:'))continue;if(!spec.startsWith('./')&&!spec.startsWith('../'))fail('closure-import');const target=path.posix.normalize(path.posix.join(path.posix.dirname(relative),spec));if(!files.includes(target))fail('closure-import');}
   }
   const target=path.join(directory,relative);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o755});for(let p=path.dirname(target);p!==directory;p=path.dirname(p))fs.chmodSync(p,0o755);fs.writeFileSync(target,data,{flag:'wx',mode:0o444});fs.chmodSync(target,0o444);
   const sha=createHash('sha256').update(data).digest('hex'),written=fs.lstatSync(target);
   if(!written.isFile()||written.uid!==uid||written.nlink!==1||(written.mode&0o777)!==0o444||createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==sha)fail('closure-copy');hashes[relative]=sha;
  }
  fs.chmodSync(directory,0o711);checkCliClosure(directory);
  return{directory,entry:path.join(directory,'scripts/test-cli-ci.mjs'),cli:path.join(directory,'apps/cli'),hashes,dispose:()=>fs.rmSync(directory,{recursive:true,force:true})};
 }catch(error){fs.rmSync(directory,{recursive:true,force:true});throw error;}
}
function identity(actor){const uid=process.getuid?.(),gid=process.getgid?.();if(!finiteId(uid)||!finiteId(gid))fail();console.log(JSON.stringify({schemaVersion:1,actor,uid,gid}));return{uid,gid};}
function run(executable,args,env,timeout,cwd=cli){const r=spawnSync(executable,args,{cwd,env,stdio:'inherit',shell:false,timeout,killSignal:'SIGKILL'});return r.error||r.signal||r.status!==0?1:0;}
export function validateCiMode(platform,arch,env){if(platform!=='linux'||arch!=='x64'||env.CI!=='true'||env.GITHUB_ACTIONS!=='true')fail();}
function actor(){
 currentPhase='ci-mode';validateCiMode(process.platform,process.arch,process.env);if(process.env.CASTLINK_CI_FIXED_ACTOR!=='1')fail();currentPhase='actor-identity';const ids=identity('legacy-private-control');requireActorIdentity(ids.uid,ids.gid);const recordedOwner=Number(process.env.CASTLINK_CI_NODE_UID);if(!/^(?:0|[1-9][0-9]*)$/.test(process.env.CASTLINK_CI_NODE_UID??''))fail();currentPhase='node-admission';const node=admitExecutable(fs.realpathSync(process.execPath),false,recordedOwner);currentPhase='actor-node-owner';if(fs.lstatSync(node).uid!==recordedOwner)fail('actor-node-owner');currentPhase='closure';checkCliClosure();
 currentPhase='actor-private-directory';
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-private-control-ci-'));try{
  const s=fs.lstatSync(temporary);if(s.uid!==1000||s.gid!==1000||!s.isDirectory()||(s.mode&0o777)!==0o700)fail('actor-private-directory');
  const env={...actorEnvironment(node,recordedOwner),HOME:temporary,TMPDIR:temporary};
  currentPhase='legacy-tests';return run(node,['--test',...legacyFiles.map(n=>path.join(cli,'tests',n))],env,300000);
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
function main(args){
 if(args.length===1&&args[0]==='--legacy-private-control-actor')return actor();
 if(args.length>1||args.length===1&&args[0]!=='--ci-fixed-private-control')fail();
 currentPhase='host-identity';const isolated=args.length===1,ids=identity('cli-host');currentPhase='ci-mode';if(isolated)validateCiMode(process.platform,process.arch,process.env);else requireActorIdentity(ids.uid,ids.gid);
 currentPhase='node-staging';const staged=isolated?stageRunningNode():null;let closure;
 try{
 currentPhase='node-admission';const node=admitExecutable(staged?.node??fs.realpathSync(process.execPath));currentPhase='partition';const partition=partitionCliTests(fs.readdirSync(path.join(cli,'tests')).filter(n=>n.endsWith('.test.mjs')),isolated);currentPhase='closure';checkCliClosure();
 let command;if(isolated){currentPhase='closure-staging';closure=stageActorClosure();command=identityCommand(node,closure.entry,ids,fs.lstatSync(node).uid);if(command.executable!==node){currentPhase='sudo-admission';admitExecutable('/usr/bin/sudo',true);currentPhase='setpriv-admission';admitExecutable('/usr/bin/setpriv',true);currentPhase='env-admission';admitExecutable('/usr/bin/env',true);}}
 currentPhase='common-tests';
 const common=run(node,['--test',...partition.common.map(n=>'tests/'+n)],process.env,900000);
 // Always run the required dedicated slice, including when the common suite fails.
 currentPhase='legacy-tests';const legacy=isolated?run(command.executable,command.args,actorEnvironment(node,fs.lstatSync(node).uid),330000,closure.cli):0;
 return suiteResult(common,legacy);
 }finally{closure?.dispose();staged?.dispose();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===script){try{process.exitCode=main(process.argv.slice(2));}catch(error){console.error(JSON.stringify(admissionDiagnostic(error,currentPhase)));console.error('CLI CI identity or test closure is unsupported; retain the measured IDs and diagnose the fixed actor.');process.exitCode=1;}}
