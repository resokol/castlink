import path from 'node:path';
import {lstat,open,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {CliError,type Executor,type Profile} from './types.js';
import {observeTargetGeneration,type TargetGeneration} from './target-operation-observer.js';
import {verifyProtectedPath} from './setup.js';
import {writeSecretFile} from './secrets.js';
import {syncDirectory} from './journal.js';
import {parseStrictJson} from './strict-json.js';
import type {TargetSqlGuard} from './target-sql-guard.js';
import type {ServiceContract,Inventory} from './services.js';
export class SetupTargetCursorError extends CliError {}
export const retainedTargetCursorDiagnosis='Retained target generation changed, is uncertain or is blocked; no fresh generation was authorized. Inspect actual target state read-only and retain the private cursor before retry.';
export const unverifiedTargetEffectDiagnosis='Fixed target helper image/SQL/filesystem contract is unverified; retain the target lock and profile, diagnose actual state read-only. No automatic effect retry is authorized.';
const refused=()=>new SetupTargetCursorError(retainedTargetCursorDiagnosis,4);
async function exists(file:string){try{await lstat(file);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
async function read(file:string){await verifyProtectedPath(file,false,false,true);const before=await lstat(file),fd=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));try{const held=await fd.stat();if(held.dev!==before.dev||held.ino!==before.ino||held.size>65536)throw refused();const b=Buffer.alloc(65537);let size=0;while(size<b.length){const n=await fd.read(b,size,b.length-size,size);if(!n.bytesRead)break;size+=n.bytesRead;}const after=await lstat(file);if(size!==held.size||size>65536||after.dev!==held.dev||after.ino!==held.ino||after.mtimeMs!==held.mtimeMs||after.ctimeMs!==held.ctimeMs)throw refused();return parseStrictJson(b.subarray(0,size).toString('utf8'),65536);}finally{await fd.close();}}
export class SetupTargetCursor {
 private file?:string;private profile?:Profile;private uncertain=false;private readonlyReceipt?:unknown;
 constructor(private generation:TargetGeneration,private readonly executor:Executor,readonly remote:boolean,readonly readOnly:boolean){}
 get binding(){const {schemaVersion:_version,active:_active,...binding}=this.generation;return structuredClone(binding);}
 private receipt(){return{schemaVersion:1,installationId:this.profile!.installationId,request:this.profile!.request,generation:this.generation,uncertain:this.uncertain};}
 private async persist(){if(!this.file||!this.profile)throw refused();if(await exists(this.file))await verifyProtectedPath(this.file,false,false,true);const temp=path.join(path.dirname(this.file),'.cursor-'+randomUUID()+'.tmp');try{await writeSecretFile(temp,JSON.stringify(this.receipt(),null,2)+'\n');await rename(temp,this.file);await syncDirectory(path.dirname(this.file));}finally{await rm(temp,{force:true});}}
 async attach(directory:string,profile:Profile,firstUse=false){
  const file=path.join(directory,'target-cursor.json'),p=structuredClone(profile);await verifyProtectedPath(directory,true,false,true);
  if(this.file){if(file!==this.file||!isDeepStrictEqual(p.request,this.profile!.request)||p.installationId!==this.profile!.installationId||!isDeepStrictEqual(await read(file),this.readOnly?this.readonlyReceipt:this.receipt()))throw refused();return;}
  this.file=file;this.profile=p;
  if(await exists(file)){
   const retained=await read(file) as ReturnType<SetupTargetCursor['receipt']>;
   if(!retained||!isDeepStrictEqual(Object.keys(retained).sort(),['generation','installationId','request','schemaVersion','uncertain'])||retained.schemaVersion!==1||retained.installationId!==p.installationId||!isDeepStrictEqual(retained.request,p.request)||typeof retained.uncertain!=='boolean')throw refused();
   if(!this.readOnly&&(retained.uncertain||!isDeepStrictEqual(retained.generation,this.generation)))throw refused();
   if(this.readOnly){const stable=(g:TargetGeneration)=>({engine:g.engine,endpoint:g.endpoint,principal:g.principal,scope:g.scope});if(!isDeepStrictEqual(stable(retained.generation),stable(this.generation)))throw refused();this.readonlyReceipt=structuredClone(retained);}else this.generation=structuredClone(retained.generation);
  }else{if(this.readOnly||firstUse!==true)throw refused();await this.persist();}
 }
 async assert(){if(this.uncertain||!isDeepStrictEqual(await observeTargetGeneration(this.executor,this.remote),this.generation))throw refused();if(this.file&&!isDeepStrictEqual(await read(this.file),this.readOnly?this.readonlyReceipt:this.receipt()))throw refused();}
 async effect<T>(operation:()=>Promise<T>):Promise<T>{
  if(this.readOnly||!this.file||!this.profile)throw refused();await this.assert();this.uncertain=true;await this.persist();
  let result:T;try{result=await operation();}catch{throw new SetupTargetCursorError(unverifiedTargetEffectDiagnosis,4);}
  this.generation={...this.generation,epoch:this.generation.epoch+1};this.uncertain=false;await this.persist();await this.assert();return result;
 }
 sqlGuard(kind:'database'|'owner'|'completion',contract:ServiceContract,resources:Inventory,fileHashes:Record<string,string>):TargetSqlGuard{
  const b=this.binding;let targetPath=path.posix;
  // The target authority selects path syntax. A Windows operator may control
  // a UID-bound Ubuntu target; its profile paths must remain POSIX.
  if(typeof b.principal==='number'){
   if(!Number.isSafeInteger(b.principal)||b.principal<0||typeof b.scope!=='string'||!b.scope.startsWith('/')||path.posix.normalize(b.scope)!==b.scope||path.posix.basename(b.scope)!=='.castlink-target-operations'||typeof b.endpoint!=='string'||!/^unix:\/\/\/[^/]/.test(b.endpoint))throw refused();
  }else{
   const p=b.principal;if(this.remote||!p||typeof p!=='object'||Object.keys(p).sort().join(',')!=='kind,sid'||p.kind!=='windows-sid'||typeof p.sid!=='string'||!/^S-1-\d+(?:-\d+){1,15}$/.test(p.sid)||typeof b.scope!=='string'||!/^[A-Z]:\\/.test(b.scope)||path.win32.normalize(b.scope)!==b.scope||path.win32.basename(b.scope)!=='.castlink-target-operations'||typeof b.endpoint!=='string'||!/^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/.test(b.endpoint))throw refused();targetPath=path.win32;
  }
  const root=this.profile!.request.root,web=resources.containers.find(c=>c.Labels['com.docker.compose.service']==='web');if(typeof root!=='string'||!targetPath.isAbsolute(root)||targetPath.resolve(root)!==root||root===targetPath.parse(root).root||targetPath===path.win32&&!/^[A-Z]:\\/.test(root)||!web||contract.installationId!==this.profile!.installationId||contract.composePath!==targetPath.join(root,'compose.yaml'))throw refused();
  return{operation:{schemaVersion:1,kind,root,installationId:this.profile!.installationId,engine:b.engine,epoch:b.epoch,principal:b.principal,scope:b.scope},endpoint:b.endpoint,fileHashes:structuredClone(fileHashes),containerId:web.Id,containerImage:web.Image,project:contract.project,configHash:contract.hashes.web!};
 }
}
export async function openSetupTargetCursor(executor:Executor,remote:boolean,readOnly=false){return new SetupTargetCursor(structuredClone(await observeTargetGeneration(executor,remote)),executor,remote,readOnly);}
