// Read-only runtime proof. No secrets, SQL errors or identity material in output.
import fs from 'node:fs/promises';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='/opt/castlink/app';
export function probeOrigin(r,port=443){
 return new Promise((resolve,reject)=>{
  const request=https.get({hostname:'127.0.0.1',port,ALPNProtocols:['http/1.1'],path:'/api/version',headers:{Host:r.host},servername:net.isIP(r.host)?'':r.host,
    ca:r.publicHttps?undefined:r.caPem,checkServerIdentity:(_,cert)=>tls.checkServerIdentity(r.host,cert),timeout:10000},response=>{
    let body='';response.on('data',chunk=>{body+=chunk;if(body.length>65536)request.destroy(Error());});
    response.on('end',()=>{try{if(response.statusCode!==200||JSON.parse(body).buildId!==r.buildId)throw Error();resolve();}catch{reject(Error());}});
  });request.on('error',reject);request.on('timeout',()=>request.destroy(Error()));
 });
}
export async function readRequest(stream=process.stdin){
 let bytes=0,chunks=[];for await(const chunk of stream){const data=Buffer.from(chunk);bytes+=data.length;if(bytes>65536)throw Error();chunks.push(data);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function main(){
 const require=createRequire(pathToFileURL(root+'/apps/web/package.json'));
 const {Pool}=require('pg');
 const r=await readRequest();
 const {schema,contentHash,scripts}=await import(pathToFileURL(root+'/scripts/setup-database-v1.mjs'));
 await scripts();
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:3000,statement_timeout:10000});
 let client;
 try{
  client=await pool.connect();await client.query('BEGIN READ ONLY');await client.query('SET LOCAL search_path TO pg_catalog,public');
  const version=Number((await client.query('SHOW server_version_num')).rows[0].server_version_num);
  if(version<160000||version>=170000)throw Error();
  await schema(client);
  const rows=(await client.query('SELECT installation_id,node_id,content_hash,migrations_verified,seed_verified FROM public.castlink_setup_bootstrap')).rows;
  if(rows.length!==1||rows[0].installation_id!==r.installationId||rows[0].node_id!==r.nodeId||rows[0].content_hash!==contentHash||rows[0].migrations_verified!==true||rows[0].seed_verified!==true)throw Error();
  await client.query('COMMIT');
 }finally{if(client)client.release();await pool.end();}
 let hash=process.env.ROOM_CREATION_PASSWORD_SHA256;
 try{const stored=JSON.parse(await fs.readFile(process.env.STUDIOLINK_DATA_DIR+'/runtime/room-creation-password.json','utf8'));if(stored.schemaVersion!==1)throw Error();hash=stored.hash;}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error();
 const livekit=await fetch('http://127.0.0.1:7880/',{signal:AbortSignal.timeout(5000)});if(!livekit.ok)throw Error();
 const setup=await fetch('http://127.0.0.1:3000/api/setup',{signal:AbortSignal.timeout(5000)});if(!setup.ok||(await setup.json()).needsSetup!==false)throw Error();
 await probeOrigin(r);
 await new Promise((resolve,reject)=>{
  const connection=tls.connect({host:'127.0.0.1',port:443,servername:net.isIP(r.turnHost)?'':r.turnHost,
   ca:r.publicHttps?undefined:r.caPem,checkServerIdentity:(_,cert)=>tls.checkServerIdentity(r.turnHost,cert)},()=>{connection.end();resolve();});
  connection.setTimeout(10000,()=>connection.destroy(Error()));connection.on('error',reject);
 });
 const converter=await fs.stat('/run/castlink-converter/converter.sock');if(!converter.isSocket())throw Error();
 console.log('CASTLINK_SERVER_READY');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('CastLink readiness verification failed');process.exitCode=3;});
