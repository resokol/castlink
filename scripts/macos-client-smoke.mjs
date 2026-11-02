// Launch the actual candidate with an isolated profile; debugging exists only
// for this test-owned process on loopback and is torn down in finally.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const [bundle,expectedArch,output]=process.argv.slice(2);
if(process.platform!=='darwin'||process.arch!==expectedArch||!['arm64','x64'].includes(expectedArch)||!bundle||!output)throw Error('Native macOS bundle smoke arguments required');
const macOS=path.join(bundle,'Contents','MacOS'),executables=fs.readdirSync(macOS);
if(executables.length!==1)throw Error('Expected one bundle executable');
const executable=path.join(macOS,executables[0]);
const arch=execFileSync('/usr/bin/lipo',['-archs',executable],{encoding:'utf8'}).trim();
if(arch!==(expectedArch==='x64'?'x86_64':'arm64'))throw Error('Wrong bundle architecture');
const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const port=server.address().port;await new Promise(resolve=>server.close(resolve));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-macos-smoke-'));
let child,ws,exitCode=null,spawnError;
try{
 child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`],{stdio:'ignore'});
 child.once('error',e=>spawnError=e);child.once('exit',code=>exitCode=code??-1);
 let target;
 for(let i=0;i<150;i++){
  if(spawnError)throw spawnError;if(exitCode!==null)throw Error(`Candidate exited early: ${exitCode}`);
  try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)});const pages=await response.json();target=pages.find(p=>p.type==='page'&&p.url.startsWith('file:')&&p.url.endsWith('/ui/start.html'));if(target)break;}catch{}
  await delay(200);
 }
 if(!target)throw Error('Packaged launcher did not load');
 const debuggerURL=new URL(target.webSocketDebuggerUrl);
 if(!['127.0.0.1','localhost'].includes(debuggerURL.hostname)||Number(debuggerURL.port)!==port)throw Error('Unexpected debugger endpoint');
 ws=new WebSocket(debuggerURL);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Debugger timeout')),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Debugger failed'));},{once:true});});
 const result=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Renderer inspection timeout')),5000);
  ws.addEventListener('message',e=>{const data=JSON.parse(e.data);if(data.id!==1)return;clearTimeout(timer);if(data.error||data.result?.exceptionDetails)reject(Error('Renderer evaluation failed'));else resolve(data.result?.result?.value);});
  ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:"({ready:document.readyState,title:document.title,buttons:document.querySelectorAll('button').length,nodeExposed:typeof process!=='undefined'||typeof require!=='undefined'})",returnByValue:true}}));
 });
 if(!['interactive','complete'].includes(result?.ready)||result.buttons<1||result.nodeExposed)throw Error('Launcher DOM or sandbox failed');
 fs.writeFileSync(output,JSON.stringify({arch:expectedArch,packagedLauncher:'PASS',sandbox:'PASS',nativeFeatures:'NOT VERIFIED'},null,2)+'\n');
 console.log('Packaged launcher and renderer isolation PASS');
}finally{
 ws?.close();
 if(child&&exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(3000)]);if(exitCode===null)child.kill('SIGKILL');}
 fs.rmSync(profile,{recursive:true,force:true});
}
