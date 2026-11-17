// Read-only public route observations. No credentials, cookies, TLS overrides or mutations.
import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
const hosts=['node2.castlink.ru','turn.node2.castlink.ru'];
const errorCode=e=>/^[A-Z0-9_]{1,64}$/.test(e?.code||'')?e.code:'REQUEST_FAILED';
function observe(host,secure=false){return new Promise(resolve=>{
 const q=(secure?https:http).get({hostname:host,port:secure?443:80,path:secure?'/api/version':'/.well-known/acme-challenge/castlink-public-route-probe',headers:{'User-Agent':'CastLink-Route-Verification/1','Connection':'close'},agent:false,rejectUnauthorized:true,timeout:10000},r=>{
  let text='',bytes=0;r.on('data',b=>{bytes+=b.length;if(bytes>65536){q.destroy();resolve({error:'RESPONSE_LIMIT'});}else text+=b});
  r.on('error',e=>resolve({error:errorCode(e)}));r.on('end',()=>{
   const server=String(r.headers.server||'');const row={status:r.statusCode,server:/^[A-Za-z0-9 ._/-]{0,64}$/.test(server)?server:'redacted',bytes};
   if(secure){try{const v=JSON.parse(text);if(typeof v.buildId==='string'&&/^[A-Za-z0-9.+-]{1,128}$/.test(v.buildId))row.buildId=v.buildId}catch{}}
   else{const t=text.toLowerCase();row.bodyFacts={tlsOnly:t.includes('http request to an https server'),badRequest:t.includes('bad request'),router:t.includes('router')||t.includes('keenetic')||t.includes('mikrotik'),blockedHttp:t.includes('only https')};}
   resolve(row);
  });
 });q.on('timeout',()=>q.destroy(Object.assign(Error(),{code:'REQUEST_TIMEOUT'})));q.on('error',e=>resolve({error:errorCode(e)}));
 });}
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_TEMP)throw Error('Own isolated CI only');
const rows=[];for(const host of hosts){const row={host};for(const[type,fn]of [['A','resolve4'],['AAAA','resolve6']]){try{row[type]=await dns[fn](host)}catch(e){row[type]={error:errorCode(e)}}}row.http=await observe(host);row.https=await observe(host,true);rows.push(row)}
const proof={schemaVersion:1,mode:'public-route-observation',verifiedHttpsOnlyWhenStatus200:true,observedAt:new Date().toISOString(),rows};
await fs.writeFile(path.join(process.env.RUNNER_TEMP,'node2-public-route-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof));
