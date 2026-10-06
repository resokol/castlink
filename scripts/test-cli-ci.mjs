#!/usr/bin/env node
// CI-only execution partition. Production UID/ownership guards are unchanged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export const legacyFiles=Object.freeze(['private-control-config.test.mjs','private-control-services.test.mjs','private-control-setup.test.mjs']);
const script=fileURLToPath(import.meta.url),root=path.dirname(path.dirname(script)),cli=path.join(root,'apps/cli');
const phases=new Set(['arguments','host-identity','ci-mode','node-admission','partition','closure','sudo-admission','setpriv-admission','env-admission','actor-identity','actor-node-owner','actor-private-directory','common-tests','legacy-tests']);
const reasons=new Set(['unsupported-input','path-not-canonical','path-symlink','executable-not-file','executable-hardlink','executable-writable','executable-not-executable','executable-owner','ancestor-not-directory','ancestor-owner','ancestor-writable','closure-not-file','closure-unexpected-entry','actor-node-owner','actor-private-directory']);
let currentPhase='arguments';
class AdmissionError extends Error {constructor(reason){super('CLI CI admission refused.');this.reason=reasons.has(reason)?reason:'unsupported-input';}}
function fail(reason='unsupported-input'){throw new AdmissionError(reason);}
export function admissionDiagnostic(error,phase){
 const reason=error instanceof AdmissionError&&Object.getPrototypeOf(error)===AdmissionError.prototype&&reasons.has(error.reason)?error.reason:
  error?.code==='ENOENT'?'io-missing':error?.code==='EACCES'||error?.code==='EPERM'?'io-permission':error?.code==='ELOOP'?'io-symlink':error?.code==='ENOTDIR'?'io-not-directory':'io-other';
 return{schemaVersion:1,phase:phases.has(phase)?phase:'unknown',reason};
}
function finiteId(v){return Number.isSafeInteger(v)&&v>=0&&v<=0xffffffff;}
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
function identity(actor){const uid=process.getuid?.(),gid=process.getgid?.();if(!finiteId(uid)||!finiteId(gid))fail();console.log(JSON.stringify({schemaVersion:1,actor,uid,gid}));return{uid,gid};}
function run(executable,args,env,timeout){const r=spawnSync(executable,args,{cwd:cli,env,stdio:'inherit',shell:false,timeout,killSignal:'SIGKILL'});return r.error||r.signal||r.status!==0?1:0;}
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
 currentPhase='node-admission';const node=admitExecutable(fs.realpathSync(process.execPath));currentPhase='partition';const partition=partitionCliTests(fs.readdirSync(path.join(cli,'tests')).filter(n=>n.endsWith('.test.mjs')),isolated);currentPhase='closure';checkCliClosure();
 let command;if(isolated){command=identityCommand(node,script,ids,fs.lstatSync(node).uid);if(command.executable!==node){currentPhase='sudo-admission';admitExecutable('/usr/bin/sudo',true);currentPhase='setpriv-admission';admitExecutable('/usr/bin/setpriv',true);currentPhase='env-admission';admitExecutable('/usr/bin/env',true);}}
 currentPhase='common-tests';
 const common=run(node,['--test',...partition.common.map(n=>'tests/'+n)],process.env,900000);
 // Always run the required dedicated slice, including when the common suite fails.
 currentPhase='legacy-tests';const legacy=isolated?run(command.executable,command.args,actorEnvironment(node,fs.lstatSync(node).uid),330000):0;
 return suiteResult(common,legacy);
}
if(process.argv[1]&&path.resolve(process.argv[1])===script){try{process.exitCode=main(process.argv.slice(2));}catch(error){console.error(JSON.stringify(admissionDiagnostic(error,currentPhase)));console.error('CLI CI identity or test closure is unsupported; retain the measured IDs and diagnose the fixed actor.');process.exitCode=1;}}
