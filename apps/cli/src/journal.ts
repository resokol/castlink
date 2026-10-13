import {readFile,open,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ensurePrivateDirectory,protectPath} from './secrets.js';
import {CliError,type StepId} from './types.js';
export async function syncDirectory(directory:string):Promise<void>{
 // Node cannot fsync directories on Windows; file sync and atomic rename still apply.
 if(process.platform==='win32')return;
 const handle=await open(directory,'r');try{await handle.sync();}finally{await handle.close();}
}
const ids:StepId[]=['preflight','runtime','release','config','services','migrations','seed','owner','verify'];
type StepState='pending'|'running'|'verified';
export type Journal={schemaVersion:1;steps:Record<StepId,StepState>};
export class FileJournal {
  constructor(readonly directory:string){}
  async read():Promise<Journal>{
    let raw:string;
    try{raw=await readFile(path.join(this.directory,'journal.json'),'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return{schemaVersion:1,steps:Object.fromEntries(ids.map(id=>[id,'pending'])) as Record<StepId,StepState>};throw error;}
    let parsed:Journal;try{parsed=JSON.parse(raw);}catch{throw new CliError('Corrupt installation journal.',4);}
    if(!parsed || parsed.schemaVersion!==1 || !parsed.steps || Object.keys(parsed).some(key=>!['schemaVersion','steps'].includes(key)) || Object.keys(parsed.steps).length!==ids.length || ids.some(id=>!['pending','running','verified'].includes(parsed.steps[id])))throw new CliError('Invalid installation journal schema.',4);
    return parsed;
  }
  async mark(step:StepId,state:StepState):Promise<void>{
    if(!ids.includes(step))throw new CliError('Unknown journal step.',4);
    if(!['pending','running','verified'].includes(state))throw new CliError('Invalid journal state.',4);
    const journal=await this.read();
    if(state==='verified' && journal.steps[step]!=='running')throw new CliError('Step must be running before verification.',4);
    journal.steps[step]=state;
    await ensurePrivateDirectory(this.directory);
    const temp=path.join(this.directory,`.journal-${randomUUID()}.tmp`);
    try{const handle=await open(temp,'wx',0o600);try{await protectPath(temp,false);await handle.writeFile(JSON.stringify(journal,null,2)+'\n');await handle.sync();}finally{await handle.close();}await rename(temp,path.join(this.directory,'journal.json'));await syncDirectory(this.directory);await syncDirectory(path.dirname(this.directory));}finally{await rm(temp,{force:true});}
  }
}
