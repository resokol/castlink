import {spawn,spawnSync} from 'node:child_process';
import {mkdir,open,lstat,unlink,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,X509Certificate} from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.umask(0o077);
const root='/root',nss=root+'/.pki/nssdb',sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{process.exitCode=4;};
async function input(){const chunks=[];let size=0;for await(const part of process.stdin){size+=part.length;if(size>16384)throw Error();chunks.push(part);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
function fixed(executable,args){const r=spawnSync(executable,args,{stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:16384});if(r.error||r.status!==0||r.stderr.length)throw Error();return r.stdout;}
async function privateDirectory(p){const s=await lstat(p);if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&511)!==448||s.uid!==process.getuid())throw Error();}
async function prepare(){
 const v=await input();if(!v||Object.keys(v).sort().join(',')!=='ca,caSHA,contract'||v.contract!=='castlink-diagnostic-browser-runtime-v1'||typeof v.ca!=='string'||!/^[a-f0-9]{64}$/.test(v.caSHA)||sha(v.ca)!==v.caSHA)throw Error();
 const cert=new X509Certificate(v.ca);if(!cert.ca)throw Error();await privateDirectory(root);
 await mkdir(root+'/.pki',{mode:448});await mkdir(nss,{mode:448});await mkdir(root+'/profile',{mode:448});
 const file=root+'/root.crt',fd=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,384);
 try{await fd.writeFile(v.ca);await fd.sync();}finally{await fd.close();}
 try{fixed('/usr/bin/certutil',['-N','--empty-password','-d','sql:'+nss]);fixed('/usr/bin/certutil',['-A','-n','CastLink diagnostic root','-t','C,,','-d','sql:'+nss,'-i',file]);}finally{await unlink(file);}
 // Public metadata only. No credential is accepted during preparation.
 process.stdout.write(JSON.stringify({contract:v.contract,prepared:true,caSHA:v.caSHA})+'\n');
}
async function browser(){
 await privateDirectory(root);await privateDirectory(nss);await privateDirectory(root+'/profile');
 // Explicit container-only synthetic preview. Host native launch must never use
 // these flags as an automatic sandbox fallback.
 const child=spawn('/usr/lib/chromium/chromium',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-pipe','--user-data-dir='+root+'/profile','--no-first-run','--no-default-browser-check','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required','--enable-usermedia-screen-capturing','--auto-select-desktop-capture-source=Entire screen','about:blank'],{detached:true,stdio:['ignore','ignore','ignore','pipe','pipe']});
 let expired=false;const deadline=setTimeout(()=>{expired=true;stop();},110000);
 function stop(){try{process.kill(-child.pid,'SIGTERM');}catch{}const force=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},500);force.unref();}
 child.on('error',fail);child.on('close',code=>{clearTimeout(deadline);process.exitCode=code===0&&!expired?0:4;process.stdin.destroy();});
 process.stdin.pipe(child.stdio[3]);child.stdio[4].pipe(process.stdout);
 process.stdin.on('end',stop);process.on('SIGTERM',stop);
}
try{
 if(process.argv.length!==3)throw Error();
 switch(process.argv[2]){
  case '--idle':setTimeout(()=>process.exit(4),180000);break;
  case '--prepare':await prepare();break;
  case '--browser':await browser();break;
  case '--inspect':{
   const manifest=JSON.parse(await readFile(fileURLToPath(new URL('./runtime-contract.json',import.meta.url)),'utf8'));
   const chrome=fixed('/usr/lib/chromium/chromium',['--version']).toString().trim();
   process.stdout.write(JSON.stringify({contract:manifest.contract,node:process.version,nodeSHA:sha(await readFile(process.execPath)),chromium:chrome,chromiumSHA:sha(await readFile('/usr/lib/chromium/chromium')),architecture:process.platform+'/'+process.arch})+'\n');break;
  }
  default:throw Error();
 }
}catch{fail();}
