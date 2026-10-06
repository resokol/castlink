import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {recoverPreparedWindowsImageCache} from '../dist/image-target-runner.js';
import {windowsLocalPreviewRelease,isWindowsLocalPreviewRelease} from '../dist/windows-local-preview.js';
import {renderBundle} from '../dist/bundle.js';
import {parseStrictJson} from '../dist/strict-json.js';
import {CliError} from '../dist/types.js';
const wp=path.win32,hash=b=>createHash('sha256').update(b).digest('hex');

// Run the actual exported orchestration with controlled IO boundaries. Worker
// PID adoption/normal lease release are exercised independently in the complete
// emitted-program fixture; this fixture isolates the final matching cursor CAS.
async function execute(mode='ok'){
 const events=[],rows=new Map(),iid='12345678-1234-1234-1234-123456789abc',root='D:\\private\\bundle',journalDirectory='D:\\private\\journal';let workerInput,renamed=false,cursorReads=0;
 const request={profile:'local-fixture',target:{kind:'local'},network:'loopback',root,release:windowsLocalPreviewRelease.release},plan={schemaVersion:1,request,steps:[],blockers:[]},options={release:windowsLocalPreviewRelease,architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory};
 const profile={schemaVersion:1,installationId:iid,request,currentRelease:request.release,secretFilePaths:{journal:wp.join(journalDirectory,'journal.json')}};
 const generation={schemaVersion:1,principal:{kind:'windows-sid',sid:'S-1-5-21-1'},scope:'D:\\private\\.castlink-target-operations',engine:'engine',endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine',epoch:1,active:false};
 const cursorFile=wp.join(journalDirectory,'target-cursor.json'),cursor={schemaVersion:1,installationId:iid,request,generation,uncertain:true},put=(p,value)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');rows.set(p,{value,sha256:hash(bytes)});};
 put(cursorFile,cursor);const initialSHA=rows.get(cursorFile).sha256;
 put(wp.join(journalDirectory,'owner.json'),{schemaVersion:1,installationId:iid,request,preparation:options});
 const files=Object.fromEntries(['compose.yaml','livekit.yaml','postgres.env','web.env'].map(n=>[n,'d'.repeat(64)])),input={release:options.release,installationId:iid,architecture:options.architecture,network:request.network,bindIPv4:options.bindIPv4,controlScope:generation.scope};
 put(wp.join(root,'receipt.json'),{schemaVersion:1,...input,hashes:files});
 const association={schemaVersion:1,installationId:iid,request,preparation:options,engine:generation.engine};put(wp.join(journalDirectory,'images-attempt.json'),association);
 for(const name of ['web','postgres','livekit'])put(wp.join(journalDirectory,'images-'+name+'.json'),{...association,service:name,reference:windowsLocalPreviewRelease.images[name].reference,image:{Id:name}});
 const steps={preflight:'verified',release:'verified',config:'verified',runtime:'pending',services:'pending',migrations:'pending',seed:'pending',owner:'pending',verify:'pending'};
 if(mode==='nonwindows'){}else if(mode==='remote')request.target={kind:'remote',host:'example.invalid',user:'test',port:22};else if(mode==='certain')cursor.uncertain=false;else if(mode==='service-progress')steps.services='verified';else if(mode==='caddy-receipt')put(wp.join(journalDirectory,'images-caddy.json'),{});
 const store={lock:async()=>{events.push('lock');return async()=>events.push('unlock')},load:async()=>profile};
 const bindings={path:wp,CliError,isWindowsLocalPreviewRelease,windowsLocalPreviewRelease,isDeepStrictEqual,parseStrictJson,renderBundle,createHash,imageRecoveryDiagnosis:'Own pinned Caddy cache completion is unverified; retain its image lease, cursor and private recovery evidence.',randomUUID:()=> '12345678-1234-1234-1234-123456789abc',recoveryExists:async p=>rows.has(p),imageRecoveryRecord:async p=>{events.push('read:'+wp.basename(p));if(p===cursorFile){cursorReads++;if(mode==='cursor-race'&&cursorReads>=3)return{...rows.get(p),sha256:'f'.repeat(64)};}if(mode==='receipt-race'&&workerInput&&wp.basename(p)==='images-web.json')return{...rows.get(p),sha256:'f'.repeat(64)};if(!rows.has(p))throw Error('absent private fixture');return structuredClone(rows.get(p));},FileJournal:class{async read(){return{steps}}},inspectProtectedBundle:async()=>files,runWindowsServiceWorker:async(bytes,family)=>{
  events.push('worker');assert.equal(family,'image-recovery');workerInput=JSON.parse(bytes);assert.equal(workerInput.cursorSHA256,initialSHA);assert.equal(workerInput.root,root);assert.deepEqual(workerInput.targets,['/data','/config']);assert.equal(workerInput.service,'caddy');assert.equal(workerInput.reference,windowsLocalPreviewRelease.images.caddy.reference);assert.equal(workerInput.installationId,iid);
  if(mode==='worker-refused')return{code:4,stdout:'{"schemaVersion":1,"status":"refused","stage":10}\n',stderr:''};if(mode==='unknown-worker-error')return{code:4,stdout:'private body must be discarded',stderr:''};
  const answer={schemaVersion:1,status:'image-lease-retired',cursorSHA256:initialSHA,oldOwnerHash:'e'.repeat(64),epoch:2,evidenceName:workerInput.evidenceName};
  put(wp.join(journalDirectory,workerInput.evidenceName+'.completed'),{schemaVersion:1,status:'image-lease-retired',cursorSHA256:initialSHA,oldOwnerHash:answer.oldOwnerHash,installationId:iid,epoch:mode==='completed-drift'?3:2,image:{Id:'caddy'},receiptSHA256:workerInput.receiptSHA256});
  return{code:0,stdout:JSON.stringify(answer)+'\n',stderr:''};
 },observeTargetGeneration:async()=>{events.push('generation');return{...generation,epoch:mode==='generation-drift'?3:2,active:mode==='active-generation'}},writeSecretFile:async(p,text)=>{events.push('write-cursor');put(p,JSON.parse(text));if(mode==='final-cursor-race')rows.set(cursorFile,{...rows.get(cursorFile),sha256:'f'.repeat(64)});},rename:async(a,b)=>{events.push('rename-cursor');assert.equal(b,cursorFile);assert.equal(rows.get(cursorFile).sha256,initialSHA);rows.set(b,rows.get(a));rows.delete(a);renamed=true},syncDirectory:async()=>events.push('sync')};
 const fn=new Function('process','Buffer',...Object.keys(bindings),'return ('+recoverPreparedWindowsImageCache.toString()+')')({platform:mode==='nonwindows'?'linux':'win32'},Buffer,...Object.values(bindings));
 let error;try{await fn(plan,options,{},store)}catch(e){error=e;}return{events,error,renamed,cursor:rows.get(cursorFile).value,workerInput};
}

test('actual recovery parent advances only unchanged matching uncertain cursor after completed evidence, fresh epoch+1 inactive generation and all retained receipt hashes',async()=>{
 const t=await execute();assert.equal(t.error,undefined,t.error?.message);assert.equal(t.renamed,true);assert.equal(t.cursor.uncertain,false);assert.equal(t.cursor.generation.epoch,2);assert.equal(t.cursor.generation.active,false);assert(t.events.indexOf('generation')<t.events.indexOf('write-cursor'));assert.deepEqual(t.events.slice(-3),['rename-cursor','sync','unlock']);
});
test('actual parent cursor/completion/generation/receipt races and worker refusals preserve uncertain cursor and release profile lock',async()=>{
 for(const mode of ['cursor-race','final-cursor-race','completed-drift','generation-drift','active-generation','receipt-race','worker-refused','unknown-worker-error','service-progress','caddy-receipt']){const t=await execute(mode);assert(t.error instanceof CliError,mode);assert.equal(t.error.code,4,mode);assert.equal(t.renamed,false,mode);assert.equal(t.cursor.uncertain,true,mode);assert.equal(t.events.at(-1),'unlock',mode);assert(!t.error.message.includes('private body'),mode);if(mode==='worker-refused')assert(t.error.message.endsWith('\n{"schemaVersion":1,"imageRecoveryStage":10}'));}
});
test('actual parent recovery is inert for other platforms, remote targets and certain cursors',async()=>{
 for(const mode of ['nonwindows','remote','certain']){const t=await execute(mode);assert.equal(t.error,undefined,mode);assert.equal(t.renamed,false,mode);assert(!t.events.includes('worker'),mode);assert(!t.events.includes('lock'),mode);}
});
