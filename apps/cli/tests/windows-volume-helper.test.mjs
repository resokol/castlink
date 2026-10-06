import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {nodePrivateVolumeServices} from '../dist/private-volume-target.js';
import {volumeCommandPlan,validateGuestMetadata} from '../dist/private-volume-protocol.js';

// Fixed helper source, synthetic inspected guest facts: no daemon/native Windows claim.
const d={schemaVersion:1,protocol:'castlink-private-volume-v1',installationId:'12345678-1234-4234-8234-123456789abc',engine:'fixture-engine',volume:'castlink-12345678123442348234123456789abc_private_control',imageId:'sha256:'+'a'.repeat(64),version:'1.13.7+castlink-idleseal-private.3'};
const cid='b'.repeat(64),nonce='c'.repeat(64),binding={installationId:d.installationId,containerId:'d'.repeat(64),digest:d.imageId,version:d.version};
const reservation={descriptor:d,root:{dev:1,ino:2},control:{dev:1,ino:3},slot:{dev:1,ino:4},uid:1000,gid:1000};
const metadata={protocol:d.protocol,phase:'initialized',reservation,binding,configSHA256:'e'.repeat(64),secretSHA256:'f'.repeat(64),state:{dev:1,ino:5},anchorSHA256:'a'.repeat(64)};
function fixture(options={}){
 const plan=volumeCommandPlan('metadata',d,nonce,binding.containerId),calls=[],records=[];
 const inspected={Id:cid,Name:'/'+plan.name,Image:d.imageId,Config:{OpenStdin:true,User:plan.user,Labels:plan.label,Entrypoint:[plan.binary],Cmd:['castlink-idle-storage-metadata'],Hostname:binding.containerId.slice(0,12)},HostConfig:{Privileged:false,NetworkMode:'none',ReadonlyRootfs:true,CapDrop:['ALL'],CapAdd:[],SecurityOpt:['no-new-privileges:true'],PortBindings:{},Mounts:[{VolumeOptions:{NoCopy:true}}]},NetworkSettings:{Ports:{}},Mounts:[{Type:'volume',Name:d.volume,Destination:'/run/castlink-idleseal',RW:false}],State:{Running:false,ExitCode:0}};
 let selected=0;
 const context=vm.createContext({volumeCommandPlan,validateGuestMetadata,pcEqual:(a,b)=>isDeepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b))),pcParse:JSON.parse,leasePath:path.win32,pcSelected(){if(++selected===options.driftAt)throw Error('engine-drift')},wvFail(){throw Error('private-volume-unverified')},winWrite(...args){records.push(args)},pcDocker(args,input){calls.push({args,input});if(args[0]==='create')return cid+'\n';if(args[0]==='inspect')return JSON.stringify([{...inspected,HostConfig:{...inspected.HostConfig,...options.hostDrift}}]);if(args[0]==='start')return JSON.stringify(options.reply??metadata);if(args[0]==='wait')return options.wait??'0\n';if(args[0]==='rm')return cid+'\n';if(args[0]==='container')return options.absence??'';throw Error('unexpected command')}});
 vm.runInContext(nodePrivateVolumeServices,context);
 return{calls,records,run:()=>context.wvTransient({scope:'D:\\Private\\.castlink-target-operations',installationId:d.installationId},{owner:{nonce},identity:{}},d,'metadata',{descriptor:d},reservation,binding)};
}
test('fixed metadata helper inspects full CID, same private slot, readonly no-copy mount, stdin then wait/reap/remove',()=>{const f=fixture();assert.deepEqual(f.run(),metadata);assert.equal(f.records.length,1);assert.equal(f.records[0][1].containerId,cid);assert.equal(f.calls.find(c=>c.args[0]==='start').input,JSON.stringify({descriptor:d}));assert.deepEqual(f.calls.filter(c=>['create','start','wait','rm','container'].includes(c.args[0])).map(c=>c.args[0]),['create','start','wait','rm','container']);});
test('failed wait, mount mismatch, guest inode drift and engine drift retain owned CID record without removing uncertain resource',()=>{for(const options of [{wait:'1\n'},{hostDrift:{ReadonlyRootfs:false}},{reply:{...metadata,reservation:{...reservation,slot:{dev:1,ino:99}}}},{driftAt:3}]){const f=fixture(options);assert.throws(f.run);assert.equal(f.records.length,1);assert.equal(f.calls.some(c=>c.args[0]==='rm'),false)}});
test('removed transient CID absence requires bounded canonical full-ID inventory, rejecting garbage and abbreviations',()=>{for(const absence of [cid+'\n',cid.slice(0,12)+'\n','unknown\n','a'.repeat(64)+'\n'+'a'.repeat(64)+'\n'])assert.throws(fixture({absence}).run);assert.deepEqual(fixture({absence:'e'.repeat(64)+'\n'}).run(),metadata)});
test('selected-engine failure immediately before transient CREATE permits zero CREATE and zero owned CID writes',()=>{const f=fixture({driftAt:1});assert.throws(f.run);assert.equal(f.calls.filter(c=>c.args[0]==='create').length,0);assert.equal(f.records.length,0)});
