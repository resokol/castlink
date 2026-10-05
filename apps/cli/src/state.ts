import { readFile, open, rename, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CliError, type Profile, type StateStore } from './types.js';
import { validateProfileName, validateRequest } from './plan.js';
import { ensurePrivateDirectory, protectPath } from './secrets.js';

function onlyFields(value: Record<string,unknown>, fields: string[]): void {
  if (Object.keys(value).some(key=>!fields.includes(key))) throw new CliError('Unsupported profile schema field.',4);
}
function object(value: unknown): value is Record<string,unknown> {return !!value && typeof value==='object' && !Array.isArray(value);}
function validateProfile(value: unknown): asserts value is Profile {
  if (!object(value) || value.schemaVersion!==1 || typeof value.installationId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.installationId) || !object(value.request) || !object(value.secretFilePaths)) throw new CliError('Invalid profile schema.',4);
  onlyFields(value,['schemaVersion','installationId','request','currentRelease','previousRelease','secretFilePaths']);
  onlyFields(value.request,['profile','target','network','root','release','domain']);
  if (!object(value.request.target)) throw new CliError('Invalid profile target.',4);
  onlyFields(value.request.target,value.request.target.kind==='local'?['kind']:['kind','host','user','port']);
  if(value.request.target.kind==='remote' && (typeof value.request.target.host!=='string' || typeof value.request.target.user!=='string'))throw new CliError('Invalid profile SSH target.',4);
  validateRequest(value.request as unknown as Profile['request']);
  for(const release of [value.currentRelease,value.previousRelease].filter(x=>x!==undefined)) if(typeof release!=='string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(release)) throw new CliError('Invalid profile release.',4);
  if(typeof value.currentRelease!=='string' || Object.values(value.secretFilePaths).some(x=>typeof x!=='string' || /[\x00\r\n]/.test(x) || !(path.posix.isAbsolute(x)||path.win32.isAbsolute(x)))) throw new CliError('Invalid profile secret-file references.',4);
}
async function noSymlink(file: string): Promise<void> {try{if((await lstat(file)).isSymbolicLink())throw new CliError('Refusing symbolic link in profile storage.',4);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}

export class FileStateStore implements StateStore {
  private readonly held=new Map<string,string>();
  constructor(readonly root: string) {}
  private directory(name:string):string {validateProfileName(name);return path.join(this.root,name);}
  async load(name:string):Promise<Profile|null> {
    const dir=this.directory(name), file=path.join(dir,'profile.json');
    await noSymlink(dir);await noSymlink(file);
    let raw:string;
    try{raw=await readFile(file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
    let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new CliError('Corrupt profile JSON; refusing a fresh installation.',4);}
    try{validateProfile(parsed);}catch{throw new CliError('Invalid profile schema; refusing to diagnose an unvalidated installation.',4);}
    if(parsed.request.profile!==name)throw new CliError('Profile name conflicts with storage directory.',4);
    return parsed;
  }
  async save(profile:Profile):Promise<void> {
    validateProfile(profile);
    const name=profile.request.profile;
    const release=this.held.has(name)?undefined:await this.lock(name);
    try {
      const previous=await this.load(name);
      if(previous && previous.installationId!==profile.installationId)throw new CliError('Installation identity conflict; refusing overwrite.',4);
      const dir=this.directory(name);await ensurePrivateDirectory(dir);
      const file=path.join(dir,'profile.json'), temp=path.join(dir,`.profile-${randomUUID()}.tmp`);
      const handle=await open(temp,'wx',0o600);
      try{await protectPath(temp,false);await handle.writeFile(JSON.stringify(profile,null,2)+'\n','utf8');await handle.sync();await handle.close();await rename(temp,file);}
      finally{await handle.close().catch(()=>{});await rm(temp,{force:true});}
    }finally{await release?.();}
  }
  async lock(name:string):Promise<()=>Promise<void>> {
    const dir=this.directory(name);await noSymlink(dir);await ensurePrivateDirectory(dir);
    const file=path.join(dir,'.lock'), token=randomUUID();
    let handle;
    try{handle=await open(file,'wx',0o600);}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new CliError('Profile is locked by another operation; diagnose before recovery.',4);throw error;}
    try{await protectPath(file,false);await handle.writeFile(JSON.stringify({schemaVersion:1,pid:process.pid,token})+'\n');await handle.sync();}
    catch(error){await handle.close();await rm(file,{force:true});throw error;}
    await handle.close();this.held.set(name,token);
    return async()=>{
      if(this.held.get(name)!==token)return;
      const current=JSON.parse(await readFile(file,'utf8')) as {token:string};
      if(current.token!==token)throw new CliError('Profile lock ownership changed.',4);
      await rm(file);this.held.delete(name);
    };
  }
  async recoverLock(name:string):Promise<void> {
    const dir=this.directory(name),file=path.join(dir,'.lock');await noSymlink(dir);await noSymlink(file);
    const raw=await readFile(file,'utf8');let lock:{pid:number;token:string;schemaVersion:number};
    try{lock=JSON.parse(raw);}catch{throw new CliError('Corrupt lock; automatic recovery refused.',4);}
    if(lock.schemaVersion!==1 || !Number.isInteger(lock.pid) || lock.pid<1 || typeof lock.token!=='string')throw new CliError('Invalid lock; recovery refused.',4);
    try{process.kill(lock.pid,0);throw new CliError('Active process owns the lock.',4);}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
    if(await readFile(file,'utf8')!==raw)throw new CliError('Lock changed during recovery.',4);
    await rm(file);
  }
}
