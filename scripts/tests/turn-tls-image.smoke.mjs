// Explicit local Docker smoke: node scripts/tests/turn-tls-image.smoke.mjs [image]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import {execFileSync,spawnSync} from 'node:child_process';
import {stockReferences} from '../package-simple-easy-setup.mjs';
const image=process.argv[2]??'castlink-turn-tls:test';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-turn-tls-'));
const name='castlink-turn-tls-smoke-'+process.pid;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
// Use the bundled executable so this proof also runs on a Windows producer.
const fixtureUser=process.getuid?['--user',String(process.getuid())+':'+String(process.getgid())]:[];
const openssl=(...args)=>docker('run','--rm',...fixtureUser,'--entrypoint','openssl','-v',temp+':/fixture','-w','/fixture',image,...args);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const host='relay.example.test';
const directory=path.join(temp,'data/caddy/certificates/acme.test',host);
let held;
fs.mkdirSync(directory,{recursive:true});
openssl('req','-x509','-newkey','rsa:2048','-nodes','-keyout','root.key','-out','root.crt','-subj','/CN=Test CA','-days','1','-addext','basicConstraints=critical,CA:TRUE');
fs.writeFileSync(path.join(temp,'extensions'),'subjectAltName=DNS:'+host+',DNS:web.example.test\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
function issue(serial){
 openssl('req','-new','-newkey','rsa:2048','-nodes','-keyout','leaf.key','-out','leaf.csr','-subj','/CN='+host);
 openssl('x509','-req','-in','leaf.csr','-CA','root.crt','-CAkey','root.key','-set_serial',String(serial),'-out','leaf.crt','-days','1','-extfile','extensions');
 fs.copyFileSync(path.join(temp,'leaf.crt'),path.join(directory,host+'.crt'));
 fs.copyFileSync(path.join(temp,'leaf.key'),path.join(directory,host+'.key'));
}
async function handshake(port,servername){
 return new Promise((resolve,reject)=>{
  const connection=tls.connect({host:'127.0.0.1',port,servername,ca:fs.readFileSync(path.join(temp,'root.crt'))},()=>{const serial=connection.getPeerCertificate().serialNumber;connection.destroy();resolve(serial);});
  connection.setTimeout(5000,()=>connection.destroy(new Error('TLS timeout')));connection.on('error',reject);
 });
}
async function webResponse(port){
 return new Promise((resolve,reject)=>{
  const chunks=[];
  const socket=tls.connect({host:'127.0.0.1',port,servername:'web.example.test',ca:fs.readFileSync(path.join(temp,'root.crt'))},()=>socket.write('GET / HTTP/1.1\r\nHost: web.example.test\r\nConnection: close\r\n\r\n'));
  socket.on('data',data=>chunks.push(data));socket.on('end',()=>resolve(Buffer.concat(chunks).toString()));socket.on('error',reject);
  socket.setTimeout(5000,()=>socket.destroy(new Error('Web response timeout')));
 });
}
try {
 issue(1);
 docker('network','create',name);
 // The exact bundled Caddy verifies web SNI and restores the original IP.
 fs.writeFileSync(path.join(temp,'Caddyfile'),'{\n admin off\n auto_https off\n servers :8443 {\n  protocols h1 h2\n  listener_wrappers {\n   proxy_protocol {\n    timeout 2s\n    allow 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16\n    fallback_policy require\n   }\n   tls\n  }\n }\n}\nhttps://web.example.test:8443 {\n tls /fixture/leaf.crt /fixture/leaf.key\n respond "{http.request.remote.host}"\n}\n');
 docker('run','--rm','-v',temp+':/fixture:ro',stockReferences.caddy,'caddy','validate','--config','/fixture/Caddyfile');
 docker('run','-d','--name',name+'-web','--network',name,'--network-alias','caddy','-v',temp+':/fixture:ro',stockReferences.caddy,'caddy','run','--config','/fixture/Caddyfile');
 // Plain TCP echo is sufficient to confirm post-TLS bytes carry a PROXYv2 header.
 docker('run','-d','--name',name+'-relay','--network',name,'--network-alias','livekit','--entrypoint','sh',image,'-c','exec nc -lk -p 5349 -e /bin/cat');
 docker('run','-d','--name',name,'--network',name,'-e','CASTLINK_TURN_HOST='+host,'-v',path.join(temp,'data')+':/data:ro','-v',path.join(temp,'root.crt')+':/etc/ssl/cert.pem:ro','-p','127.0.0.1::443',image);
 const binding=docker('port',name,'443/tcp');const port=Number(binding.split(':').at(-1));
 for(let attempt=0;;attempt++){try{assert.equal(await handshake(port,host),'01');break;}catch(error){if(attempt>=15)throw error;await pause(1000);}}
 assert.equal(await handshake(port,'web.example.test'),'01');
 const clientIp=(await webResponse(port)).split('\r\n\r\n')[1];
 const muxIp=docker('inspect',name,'--format','{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}');
 // Docker rewrites localhost's source to the bridge gateway on some hosts.
 // The PROXY header restores that original frontend peer, never the mux's IP.
 assert.match(clientIp,/^\d+\.\d+\.\d+\.\d+$/);
 assert.notEqual(clientIp,muxIp,'Caddy must receive the frontend peer IP rather than the HAProxy container IP');
 held=await new Promise((resolve,reject)=>{const socket=tls.connect({host:'127.0.0.1',port,servername:host,ca:fs.readFileSync(path.join(temp,'root.crt'))},()=>resolve(socket));socket.on('error',reject);});
 const echoed=[];held.on('data',data=>echoed.push(data));
 held.write('castlink-relay-payload\n');
 issue(2);
 for(let attempt=0;;attempt++){if(await handshake(port,host)==='02')break;if(attempt>=25)throw Error('renewal not applied');await pause(1000);}
 assert.match(docker('logs',name),/existing relay sessions preserved/);
 assert.equal(held.destroyed,false,'certificate reload must retain an existing relay TLS session');
 const relayLog=Buffer.concat(echoed).toString();
 assert.ok(relayLog.includes('castlink-relay-payload'),'TLS mux forwards decrypted relay payload');
 assert.ok(relayLog.includes('\r\n\r\n\0\r\nQUIT\n'),'TURN backend receives PROXYv2 with the original peer address');
 // A wrong private key never replaces the active valid certificate.
 openssl('genrsa','-out','wrong.key','2048');fs.copyFileSync(path.join(temp,'wrong.key'),path.join(directory,host+'.key'));
 await pause(16000);assert.equal(await handshake(port,host),'02');
 console.log('TURN TLS image: SNI routing, trusted certificates, PROXYv2/payload forwarding, retained session on renewal, mismatched-key rejection passed');
} catch(error) {
 // Capture only our test containers, before cleanup removes startup evidence.
 for(const container of [name,name+'-web',name+'-relay']){
  try { console.error('TURN smoke state '+container+' '+docker('inspect',container,'--format','{{json .State}} {{json .NetworkSettings.Ports}}')); } catch {}
  try { const log=spawnSync('docker',['logs','--tail','30',container],{encoding:'utf8',stdio:['ignore','pipe','pipe']});if(log.status===0)console.error('TURN smoke logs '+container+'\n'+(log.stdout+log.stderr).slice(-12000)); } catch {}
 }
 throw error;
} finally {
 held?.destroy();
 for(const container of [name,name+'-web',name+'-relay']){try{docker('rm','-f',container);}catch{}}
 try{docker('network','rm',name);}catch{}
 fs.rmSync(temp,{recursive:true,force:true});
}
