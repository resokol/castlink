'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const OWNER='castlink-macos-managed-servers-v1',UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/,VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const ALLOWED=new Set(['compose.json','postgres.env','web.env','livekit.json','Caddyfile','secrets.json','server-origin-ca.pem']);
function json(file,limit=1024*1024){const info=fs.lstatSync(file);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw Error('Invalid server receipt');return JSON.parse(fs.readFileSync(file,'utf8'));}
function endpoint(value){if(!value||typeof value.host!=='string'||!/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(value.host)||value.host.includes('..')||!Number.isInteger(value.port)||value.port<1||value.port>65535||!/^SHA256:[A-Za-z0-9+/]{43}$/.test(value.fingerprint))throw Error('Invalid verified SSH identity');return {host:value.host,port:value.port,fingerprint:value.fingerprint};}
function origin(value){const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid saved server origin');return url.origin;}
function publicRecord(input,result){
 if(result.completed!==true||!UUID.test(result.installationId||'')||!VERSION.test(result.version||'')||!/^[a-f0-9]{40}$/.test(result.sourceCommit||'')||typeof result.daemonId!=='string'||!result.daemonId||result.daemonId.length>256||/[\x00-\x20]/.test(result.daemonId))throw Error('Verified server provenance or identity is unavailable');
 if(!['local','ssh'].includes(input.target)||typeof input.folder!=='string'||!path.posix.isAbsolute(input.folder)||/[\0\r\n]/.test(input.folder))throw Error('Invalid installation identity');
 const value={target:input.target,folder:input.folder,installationId:result.installationId,origin:origin(result.origin),version:result.version,sourceCommit:result.sourceCommit,daemonId:result.daemonId,verifiedAt:result.verifiedAt||input.verifiedAt||Date.now(),removed:input.removed===true};if(input.target==='ssh')value.ssh=endpoint(input.ssh);
 const configuration=result.configuration||input.configuration;if(configuration&&typeof configuration==='object'){
  const safe={};for(const name of ['setupMode','publicHttps','turnDomain'])if(Object.hasOwn(configuration,name))safe[name]=configuration[name];
  if(configuration.network&&typeof configuration.network==='object'){safe.network={};for(const name of ['mode','publicOrigin','mediaIp','bindAddress','httpPort','httpsPort','iceTcpPort','iceUdpPort','turnUdpPort','relayPortStart','relayPortEnd','trustedProxies'])if(Object.hasOwn(configuration.network,name))safe.network[name]=configuration.network[name];}
  if(Buffer.byteLength(JSON.stringify(safe))>16384)throw Error('Invalid public server configuration');value.configuration=safe;
 }return value;
}
function records(indexPath){if(!indexPath||!fs.existsSync(indexPath))return [];const value=json(indexPath);if(value.schemaVersion!==1||value.owner!==OWNER||!Array.isArray(value.installations)||value.installations.length>64)throw Error('Invalid managed server index');return value.installations.map(entry=>publicRecord(entry,{...entry,completed:true}));}
function nativeIdentity(saved,actual){return typeof saved==='string'&&/^(0|[1-9][0-9]*)$/.test(saved)?saved===actual.toString():Number.isSafeInteger(saved)&&BigInt(saved)===actual;}
function key(record){return [record.target,record.ssh?.host||'',record.ssh?.port||'',record.folder].join('\0');}
function write(indexPath,installations){if(!path.isAbsolute(indexPath))throw Error('Absolute server index required');fs.mkdirSync(path.dirname(indexPath),{recursive:true,mode:0o700});if(fs.existsSync(indexPath)&&fs.lstatSync(indexPath).isSymbolicLink())throw Error('Invalid server index');const temporary=indexPath+'.'+crypto.randomUUID();try{fs.writeFileSync(temporary,JSON.stringify({schemaVersion:1,owner:OWNER,installations},null,2)+'\n',{flag:'wx',mode:0o600});fs.renameSync(temporary,indexPath);}finally{fs.rmSync(temporary,{force:true});}}
function recordMacInstallation(indexPath,input,result){const saved=records(indexPath),entry=publicRecord(input,result);write(indexPath,[...saved.filter(other=>key(other)!==key(entry)),entry].slice(-64));return entry;}
function removeMacInstallation(indexPath,input,installationId,retain=false){const saved=records(indexPath),target={target:input.target,folder:input.folder,ssh:input.ssh};write(indexPath,retain?saved.map(entry=>key(entry)===key(target)&&entry.installationId===installationId?{...entry,removed:true}:entry):saved.filter(entry=>key(entry)!==key(target)||entry.installationId!==installationId));}
async function boundedBody(response){if(!response.ok)throw Error('Version is unavailable');let text='',bytes=0;if(response.body){for await(const chunk of response.body){bytes+=chunk.length;if(bytes>16384)throw Error('Version response too large');text+=Buffer.from(chunk).toString('utf8');}}else{text=await response.text();if(Buffer.byteLength(text)>16384)throw Error('Version response too large');}return JSON.parse(text);}
async function discoverMacServerBuilds({indexPath,fetch=globalThis.fetch,readDaemonId}={}){
 let saved;try{saved=records(indexPath);}catch{return [];}
 const builds=[];
 for(const entry of saved)try{
  if(entry.removed)continue;
  if(entry.target==='local'){
   const folder=path.resolve(entry.folder);for(let current=folder;;current=path.dirname(current)){if(fs.lstatSync(current).isSymbolicLink())throw Error();if(path.dirname(current)===current)break;}
   const info=fs.statSync(folder,{bigint:true});if(typeof process.getuid==='function'&&info.uid!==BigInt(process.getuid())||info.mode&0o077n)continue;
   const state=json(path.join(folder,'.castlink-install.json')),receipt=json(path.join(folder,'.castlink-macos-owner.json'),32768),compose=json(path.join(folder,'compose.json'));
   if(state.schemaVersion!==1||state.owner!=='castlink-linux-compose-v1'||state.completed!==true||state.removed||state.installationId!==entry.installationId||state.release?.version!==entry.version||state.release?.commit!==entry.sourceCommit)continue;
   if(receipt.owner!=='castlink-macos-compose-v1'||receipt.target!=='local'||receipt.installationId!==entry.installationId||receipt.folder!==folder||!nativeIdentity(receipt.device,info.dev)||!nativeIdentity(receipt.inode,info.ino)||receipt.daemon!==entry.daemonId||!receipt.files||typeof receipt.files!=='object'||Array.isArray(receipt.files))continue;
   const actual=fs.readdirSync(folder).filter(name=>ALLOWED.has(name));if(actual.length!==Object.keys(receipt.files).length||actual.some(name=>!Object.hasOwn(receipt.files,name)))continue;
   let valid=Object.keys(receipt.files).length>0;for(const [name,checksum] of Object.entries(receipt.files)){if(!ALLOWED.has(name)||!/^[a-f0-9]{64}$/.test(checksum)){valid=false;break;}const file=path.join(folder,name),stat=fs.lstatSync(file);if(!stat.isFile()||stat.size>1024*1024||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==checksum){valid=false;break;}}
   if(!valid||compose.services?.web?.image!=='castlink-easy-web:'+entry.sourceCommit||origin(state.network?.publicOrigin)!==entry.origin)continue;
   if(readDaemonId&&await readDaemonId(entry)!==entry.daemonId)continue;
  }else{
   if(!entry.origin.startsWith('https://'))continue;
   const value=await boundedBody(await fetch(entry.origin+'/api/version',{headers:{Accept:'application/json'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)}));
   if(value.productVersion!==entry.version||value.buildId!==entry.version+'-'+entry.sourceCommit.slice(0,12))continue;
  }
  builds.push({track:'server-setup',version:entry.version,sourceCommit:entry.sourceCommit,folder:entry.folder,target:entry.target,installationId:entry.installationId,origin:entry.origin,daemonId:entry.daemonId,...(entry.ssh?{ssh:entry.ssh}:{})});
 }catch{}return builds;
}
function verifiedMacRecord(indexPath,record){if(!record||!['local','ssh'].includes(record.target))throw Error('Invalid saved setup target');const match=records(indexPath).find(entry=>entry.installationId===record.installationId&&key(entry)===key(record));if(!match||record.ssh?.fingerprint!==match.ssh?.fingerprint)throw Error('Saved setup target changed');return match;}
module.exports={listMacInstallations:records,recordMacInstallation,removeMacInstallation,discoverMacServerBuilds,verifiedMacRecord};
