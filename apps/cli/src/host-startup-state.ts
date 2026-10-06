import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {validateDesiredRecord,type DesiredRecord} from './lifecycle-controller.js';
// Trusted fixed target runner must supply the CURRENT held lease assertion.
// This callback is an integration contract, not proof of a native lease.
export interface DesiredStateGuard {assertOwned(scope:string,installationId:string):void}
function fail():never{throw Error('controller-desired-state-unverified')}
function privatePath(p:string,directory:boolean):fs.Stats{const s=fs.lstatSync(p);if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile())||s.uid!==process.getuid!()||(s.mode&0o777)!==(directory?0o700:0o600)||!directory&&s.nlink!==1)fail();for(let parent=path.dirname(p);parent!==path.dirname(parent);parent=path.dirname(parent))if(fs.lstatSync(parent).isSymbolicLink())fail();return s}
function location(scope:string,id:string,guard:DesiredStateGuard):string{
 if(process.platform==='win32'||!process.getuid)throw Error('native-controller-desired-state-protection-unavailable');
 if(!path.isAbsolute(scope)||path.resolve(scope)!==scope||scope===path.parse(scope).root||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)||fs.realpathSync(scope)!==scope)fail();guard.assertOwned(scope,id);privatePath(scope,true);return path.join(scope,'controller-'+id+'.json');
}
function capture(file:string):DesiredRecord|null{
 let before:fs.Stats;try{before=privatePath(file,false)}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e}
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const held=fs.fstatSync(fd);if(held.dev!==before.dev||held.ino!==before.ino||held.size!==before.size||held.mtimeMs!==before.mtimeMs||held.ctimeMs!==before.ctimeMs||!held.isFile()||held.uid!==before.uid||held.mode!==before.mode||held.nlink!==1||held.size>8192)fail();const b=Buffer.alloc(8193);let size=0;while(size<b.length){const n=fs.readSync(fd,b,size,b.length-size,size);if(!n)break;size+=n}const after=fs.fstatSync(fd),named=fs.lstatSync(file);if(size>8192||size!==held.size||held.size!==after.size||held.mtimeMs!==after.mtimeMs||held.ctimeMs!==after.ctimeMs||named.dev!==held.dev||named.ino!==held.ino||after.uid!==held.uid||after.mode!==held.mode||after.nlink!==1||named.uid!==held.uid||named.mode!==held.mode||named.nlink!==1)fail();return validateDesiredRecord(parseStrictJson(b.subarray(0,size).toString('utf8'),8192) as DesiredRecord)}finally{fs.closeSync(fd)}
}
export function readDesiredState(scope:string,id:string,guard:DesiredStateGuard):DesiredRecord|null{try{return capture(location(scope,id,guard))}catch(e){if((e as Error).message==='native-controller-desired-state-protection-unavailable')throw e;fail()}}
export function writeDesiredState(scope:string,id:string,previous:DesiredRecord|null,next:DesiredRecord,guard:DesiredStateGuard):void{
 try{
  const value=validateDesiredRecord(next),expected=previous===null?null:validateDesiredRecord(previous),file=location(scope,id,guard),before=privatePath(scope,true);
  if(value.revision!==(expected?.revision??0)+1||!isDeepStrictEqual(capture(file),expected))fail();
  const directory=fs.openSync(scope,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY),temporary=path.join(scope,'controller-'+id+'-'+value.operationNonce+'.tmp');
  try{
   const held=fs.fstatSync(directory);if(held.dev!==before.dev||held.ino!==before.ino)fail();
   const assert=()=>{guard.assertOwned(scope,id);const named=privatePath(scope,true);if(named.dev!==held.dev||named.ino!==held.ino||named.uid!==held.uid||named.mode!==held.mode)fail()};
   assert();const fd=fs.openSync(temporary,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
   try{assert();const b=Buffer.from(JSON.stringify(value)+'\n');let offset=0;while(offset<b.length)offset+=fs.writeSync(fd,b,offset,b.length-offset);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
   assert();if(!isDeepStrictEqual(capture(file),expected))fail();fs.renameSync(temporary,file);fs.fsyncSync(directory);assert();
  }finally{fs.closeSync(directory)}
 }catch(e){if((e as Error).message==='native-controller-desired-state-protection-unavailable')throw e;fail()}
 // No generic cleanup/recovery of partial temp/intent/lease records on error.
}
