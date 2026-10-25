import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {runCli} from '../dist/main.js';
import {requestFromArgs} from '../dist/wizard.js';
import {parseArgs} from '../dist/args.js';
import {validateRequest} from '../dist/plan.js';
import {validateReleaseManifest} from '../dist/bundle.js';
import {windowsLocalPreviewRelease} from '../dist/windows-local-preview.js';
import {profileRoot} from '../dist/profile.js';
import {CliError} from '../dist/types.js';
import {parseStrictJson} from '../dist/strict-json.js';
import {constants} from 'node:fs';

const base='D:\\GitHub\\SL\\studiolink\\easy-setup-profiles';
const selectedProcess={platform:'win32',env:{CASTLINK_PROFILE_ROOT:base}};
const selectedRoot=()=>profileRoot(selectedProcess.env,'win32','C:\\Users\\test');
const wizardBindings={process:selectedProcess,path:path.win32,os,CliError,profileRoot:selectedRoot};
const selectedWizard=new Function(...Object.keys(wizardBindings),'return ('+requestFromArgs.toString()+')')(...Object.values(wizardBindings));
const windows=action=>action();
test('Windows wizard keeps the selected installation under the configured D drive',()=>windows(async()=>{
 const answers=['local','home','',''];
 const request=await selectedWizard(parseArgs(['setup']),{readLine:async()=>answers.shift()??''});
 assert.equal(request.root,path.win32.join(base,'home-server'));
}));
test('outer Easy Setup target selection still uses guided profile and bundled local preset',async()=>{
 const answers=['home','',''],prompts=[];let captured;
 const bindings={process:selectedProcess,parseArgs,requestFromArgs:selectedWizard,validateRequest,validateReleaseManifest,windowsLocalPreviewRelease,profileRoot:selectedRoot,CliError,path:path.win32,executeSetup:async(plan,executor,store,options)=>{captured={plan,options};return{applicationReady:true,browserTrust:'unverified',checks:[],owner:{filePath:'D:\\owner.txt',origin:'https://127.0.0.1',expiresAt:1800000000000}};}};
 const invoke=new Function(...Object.keys(bindings),'return ('+runCli.toString()+')')(...Object.values(bindings));
 const code=await invoke(['setup','--target','local','--easy-setup'],{readLine:async p=>{prompts.push(p);return answers.shift()??'';},write:()=>{},store:{load:async()=>null},executor:{}});
 assert.equal(code,3);assert.equal(captured?.plan.request.profile,'home');
 assert.deepEqual(captured?.options.release,windowsLocalPreviewRelease);assert.equal(prompts.length,3);
});
test('VPS wizard records public HTTPS and direct ICE declarations without a TURN prompt',async()=>{
 const answers=['remote','vps','node.castlink.net','root','','','studio.castlink.net','203.0.113.54',''],prompts=[];
 const request=await selectedWizard(parseArgs(['setup']),{readLine:async p=>{prompts.push(p);return answers.shift()??'';}});
 assert.deepEqual(request.internet,{domain:'studio.castlink.net',publicIPv4:'203.0.113.54'});
 assert.equal(request.domain,'studio.castlink.net');assert.equal(request.target.host,'node.castlink.net');
 assert.equal(request.root,'/opt/castlink/vps');assert(prompts.some(p=>/IPv4/.test(p)));
 assert(!prompts.some(p=>/TURN/.test(p)));
});
test('saved public profile rejects a changed declared IPv4 before remote effects',async()=>{
 const saved={profile:'vps',target:{kind:'remote',host:'node.castlink.net',user:'root',port:22},network:'internet',domain:'studio.castlink.net',internet:{domain:'studio.castlink.net',publicIPv4:'203.0.113.54'},root:'/opt/castlink/vps',release:'1.0.0'};
 const answers=['remote','vps'];
 await assert.rejects(()=>selectedWizard(parseArgs(['setup','--public-ipv4','198.51.100.43']),{readLine:async()=>answers.shift()??''},async()=>saved),e=>e instanceof CliError);
 const accepted=['remote','vps'];
 assert.deepEqual(await selectedWizard(parseArgs(['setup','--public-ipv4','203.0.113.54']),{readLine:async()=>accepted.shift()??''},async()=>saved),saved);
});
test('interactive resume retains the saved release, root and network without asking for technical inputs',()=>windows(async()=>{
 const saved={profile:'home',target:{kind:'local'},network:'loopback',root:'D:\\GitHub\\SL\\studiolink\\existing-server',release:'0.0.0-windows-local-preview.1'};
 const answers=['local','home'],prompts=[];
 const actual=await selectedWizard(parseArgs(['setup']),{readLine:async p=>{prompts.push(p);assert(answers.length,'Unexpected prompt after saved profile');return answers.shift();}},async name=>{assert.equal(name,'home');return saved;});
 assert.deepEqual(actual,saved);assert.notEqual(actual,saved);assert.equal(prompts.length,2);
}));
test('interactive resume refuses a saved profile for a different target',()=>windows(async()=>{
 const answers=['local','home'];
 await assert.rejects(()=>selectedWizard(parseArgs(['setup']),{readLine:async()=>answers.shift()??''},async()=>({profile:'home',target:{kind:'remote',host:'server.example.org',user:'root',port:22},network:'internet',domain:'studio.example.org',root:'/opt/castlink/home',release:'1.0.0'})),e=>e instanceof CliError&&e.code===4);
}));
test('interactive remote resume rejects changed SSH host, user or port instead of silently ignoring them',()=>windows(async()=>{
 const saved={profile:'home',target:{kind:'remote',host:'server.example.org',user:'root',port:22},network:'internet',domain:'studio.example.org',root:'/opt/castlink/home',release:'1.0.0'};
 for(const [key,value] of [['host','other.example.org'],['user','deploy'],['port','2222']]){
  const answers=['remote','home'];
  await assert.rejects(()=>selectedWizard(parseArgs(['setup','--'+key,value]),{readLine:async()=>answers.shift()??''},async()=>saved),e=>e instanceof CliError&&e.code===4);
 }
 const answers=['remote','home'];
 assert.deepEqual(await selectedWizard(parseArgs(['setup','--host',saved.target.host,'--user','root','--port','22']),{readLine:async()=>answers.shift()??''},async()=>saved),saved);
}));
test('actual CLI dispatch supplies the publisher-owned local preset without developer prompts',()=>windows(async()=>{
 const answers=['local','home','',''],prompts=[],output=[];let captured;
 const bindings={process:selectedProcess,parseArgs,requestFromArgs:selectedWizard,validateRequest,validateReleaseManifest,windowsLocalPreviewRelease,profileRoot:selectedRoot,CliError,path:path.win32,executeSetup:async(plan,executor,store,options)=>{captured={plan,options};return{applicationReady:true,browserTrust:'unverified',checks:[],owner:{filePath:path.win32.join(base,'home-journal','owner-invite.txt'),origin:'https://127.0.0.1',expiresAt:1800000000000}};}};
 const invoke=new Function(...Object.keys(bindings),'return ('+runCli.toString()+')')(...Object.values(bindings));
 const code=await invoke(['setup'],{readLine:async p=>{prompts.push(p);return answers.shift()??'';},write:s=>output.push(s),store:{load:async()=>null},executor:{}});
 assert(captured,'setup must receive its packaged preset');
 assert.deepEqual(captured.options,{release:windowsLocalPreviewRelease,architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory:path.win32.join(base,'home-journal')});
 assert.equal(captured.plan.request.release,windowsLocalPreviewRelease.release);
 assert.equal(prompts.length,4);assert.equal(code,3);assert.match(output.join(''),/127\.0\.0\.1/);
}));
test('guided VPS setup consumes its packaged schema1 release and hides manifest architecture and journal prompts',async()=>{
 const release={schemaVersion:1,release:'1.0.0-rc.2-abcdef123456',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,{reference:'registry.castlink.net/'+name+'@sha256:'+'a'.repeat(64),architectures:['amd64']}]))};
 const bytes=Buffer.from(JSON.stringify(release)),selected={...selectedProcess,execPath:'D:\\CastLink\\app\\runtime\\node.exe'};
 const answers=['vps','node.castlink.net','root','','','studio.castlink.net','8.8.8.8','',''],prompts=[],output=[];let captured,opened;
 const open=async file=>{opened=file;return{stat:async()=>({isFile:()=>true,size:bytes.length}),read:async(buffer,offset,length,position)=>({bytesRead:bytes.copy(buffer,offset,position,position+length)}),close:async()=>{}};};
 const bindings={process:selected,parseArgs,requestFromArgs:selectedWizard,validateRequest,validateReleaseManifest,windowsLocalPreviewRelease,profileRoot:selectedRoot,CliError,path:path.win32,parseStrictJson,constants,open,SshExecutor:class{},executeSetup:async(plan,executor,store,options)=>{captured={plan,options};return{applicationReady:true,browserTrust:'unverified',checks:[],owner:{filePath:'/opt/castlink/owner-fixture/owner-invite.txt',origin:'https://studio.castlink.net',expiresAt:1800000000000}};}};
 const invoke=new Function(...Object.keys(bindings),'return ('+runCli.toString()+')')(...Object.values(bindings));
 const code=await invoke(['setup','--target','remote','--easy-setup'],{readLine:async p=>{prompts.push(p);return answers.shift()??'';},write:s=>output.push(s),store:{load:async()=>null},executor:{}});
 assert.equal(code,3);assert(captured);assert.equal(opened,'D:\\CastLink\\server\\release.json');
 assert.equal(captured.plan.request.release,release.release);assert.deepEqual(captured.options.release,release);
 assert.equal(captured.options.architecture,'amd64');assert.equal(captured.options.bindIPv4,'8.8.8.8');
 assert.equal(captured.options.journalDirectory,path.win32.join(base,'vps-journal'));
 assert.equal(captured.options.remoteScope,'/opt/castlink');assert.deepEqual(captured.options.internet,{domain:'studio.castlink.net',publicIPv4:'8.8.8.8'});
 assert(!prompts.some(p=>/manifest|architecture|journal|Release identifier|scope directory/i.test(p)));assert.match(output.join(''),/Файл приглашения находится на VPS/);assert.match(output.join(''),/Публичная цепочка HTTPS проверена/);assert.doesNotMatch(output.join(''),/подтвердить доверие сертификату/);
});
