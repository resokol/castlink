import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:https';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {requestServerPeer} from '../server-peer-request.mjs';

test('SSH-pinned HTTPS verifies origin hostname/CA, handles numeric hosts, and refuses redirects',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'castlink-peer-tls-'));
 const keyfile=path.join(directory,'key.pem'),certfile=path.join(directory,'cert.pem');
 await promisify(execFile)('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=reserve.example.com','-addext','subjectAltName=DNS:reserve.example.com,IP:8.8.8.8','-keyout',keyfile,'-out',certfile]);
 const ca=await readFile(certfile,'utf8'),key=await readFile(keyfile);let requests=0;
 const server=createServer({key,cert:ca},(request,response)=>{requests++;if(request.url.includes('drip')){response.writeHead(200,{'content-type':'application/json'});response.write('{');const timer=setInterval(()=>response.write(' '),10);request.on('close',()=>clearInterval(timer));return;}if(request.url.includes('redirect')){response.writeHead(302,{location:'https://169.254.169.254/api/private'});response.end();}else if(request.url.includes('empty204')){response.writeHead(204);response.end();}else if(request.url.includes('empty205')){response.writeHead(205);response.end();}else{response.setHeader('content-type','application/json');response.end('{"ok":true}');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port,peer={id:randomUUID(),installationId:randomUUID(),scope:{kind:'room',roomId:randomUUID()},secret:'a'.repeat(64),label:'Fixture',origin:`https://reserve.example.com:${port}`,connectAddress:'127.0.0.1',ca};
 try{
  assert.equal((await requestServerPeer(peer,'/api/server-transfer?action=health')).status,200);
  assert.equal((await requestServerPeer({...peer,origin:`https://8.8.8.8:${port}`},'/api/server-transfer?action=health')).status,200);
  await assert.rejects(requestServerPeer({...peer,origin:`https://wrong.example.com:${port}`},'/api/server-transfer?action=health'),error=>error.message==='Peer HTTPS verification or connection failed'&&error.cause?.code==='ERR_TLS_CERT_ALTNAME_INVALID');
  await assert.rejects(requestServerPeer({...peer,ca:undefined},'/api/server-transfer?action=health'),/HTTPS/);
  await assert.rejects(requestServerPeer(peer,'/api/server-transfer?action=redirect'),/redirect/i);
  assert.equal((await requestServerPeer(peer,'/api/server-transfer?action=empty204')).status,204);
  assert.equal((await requestServerPeer(peer,'/api/server-transfer?action=empty205')).status,205);
  assert.equal(requests,5);
  await assert.rejects(requestServerPeer(peer,'https://169.254.169.254/api/private'),/path/i);
  assert.equal(requests,5);
  await assert.rejects(requestServerPeer(peer,'/api/health',{headers:{invalid:'line\nbreak'},timeoutMs:40}),/header/i);
  const started=Date.now();await assert.rejects(requestServerPeer(peer,'/api/drip',{timeoutMs:120}),error=>error.cause?.code==='ETIMEDOUT');assert.ok(Date.now()-started<600,'continuous response bytes cannot extend total deadline');
 }finally{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
