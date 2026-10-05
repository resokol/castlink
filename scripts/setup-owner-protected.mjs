// Server-only private durable files. No secret-bearing error messages.
import {constants} from 'node:fs';
import {lstat,open,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
export class OwnerRefusal extends Error {constructor(diagnosis){super(diagnosis);this.diagnosis=diagnosis;}}
export const refuse=diagnosis=>{throw new OwnerRefusal(diagnosis);};
export async function exists(file){try{await lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function check(file,directory,privateMode=true){
 const s=await lstat(file);
 if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile())||s.uid!==process.getuid()||privateMode&&(s.mode&0o777)!==(directory?0o700:0o600)||!directory&&(s.nlink!==1||s.size>2048))refuse('owner-file-conflict');
 return s;
}
export async function syncDirectory(directory){const h=await open(directory,'r');try{await h.sync();}finally{await h.close();}}
export async function ownerFile(data,id){
 if(!path.isAbsolute(data)||path.resolve(data)!==data||data==='/')refuse('owner-file-conflict');
 // All parent components must be real directories. Shared /tmp is allowed for
 // disposable tests; the server subtree itself requires exact private ownership.
 let current='/';for(const part of data.split('/').filter(Boolean)){current=path.join(current,part);const s=await lstat(current);if(s.isSymbolicLink()||!s.isDirectory())refuse('owner-file-conflict');}
 await check(data,true,false);
 const base=path.join(data,'.castlink-owner'),directory=path.join(base,id);
 for(const dir of [base,directory]){if(!await exists(dir)){await mkdir(dir,{mode:0o700});await syncDirectory(path.dirname(dir));}await check(dir,true);}
 const entries=await readdir(directory);if(entries.some(n=>n!=='owner-invite.txt'))refuse('owner-file-conflict');
 return path.join(directory,'owner-invite.txt');
}
export async function readInvite(file){
 const before=await check(file,false),h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const held=await h.stat();if(before.ino!==held.ino||before.dev!==held.dev)refuse('owner-file-conflict');const text=await h.readFile('utf8'),after=await check(file,false);if(after.ino!==held.ino||after.dev!==held.dev)refuse('owner-file-conflict');return text;}finally{await h.close();}
}
export async function writeInvite(file,text){
 const h=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 // Keep incomplete files after failures: their durable SQL attempt may already
 // exist, so deleting them would obscure evidence and permit silent replacement.
 try{await h.writeFile(text,'utf8');await h.sync();}finally{await h.close();}
 await syncDirectory(path.dirname(file));
}
