import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {observeNativeWindowsPreflight} from '../dist/windows-native-preflight.js';
import {windowsDoctorDiagnostic} from '../dist/windows-doctor-diagnostic.js';
test('actual preflight failure stages retain typed refusal without secret worker bytes and successful replies stay quiet',()=>{
 const platform=Object.getOwnPropertyDescriptor(process,'platform'),prior=globalThis.__castlinkWindowsNativeRuntime,write=fs.writeSync,lines=[];
 try{Object.defineProperty(process,'platform',{value:'win32'});fs.writeSync=(fd,text)=>{assert.equal(fd,2);lines.push(text);return Buffer.byteLength(text)};
 const facts={schemaVersion:1,engine:'own',endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine',serverOS:'linux',serverArch:'amd64',serverVersion:'29.8.2',composeVersion:'2.40.3',dockerSHA256:'a'.repeat(64),composeSHA256:'b'.repeat(64)};
 for(const [stage,hook] of [[81,()=>{throw Error('SECRET_PATH')}],[82,()=>({status:'unknown',stdout:'SECRET'})],[83,()=>({status:'ok',stdout:'SECRET'})],[84,()=>({status:'ok',stdout:JSON.stringify({...facts,endpoint:'SECRET'})})]]){lines.length=0;globalThis.__castlinkWindowsNativeRuntime=hook;assert.throws(()=>observeNativeWindowsPreflight(),e=>e.code===4&&!e.message.includes('SECRET'));assert.deepEqual(lines,[JSON.stringify({schemaVersion:1,operation:14,stage,status:4})+'\n'])}
 lines.length=0;globalThis.__castlinkWindowsNativeRuntime=()=>({status:'ok',stdout:JSON.stringify(facts)});assert.deepEqual(observeNativeWindowsPreflight(),facts);assert.equal(lines.length,0);delete globalThis.__castlinkWindowsNativeRuntime;assert.throws(()=>observeNativeWindowsPreflight());assert.equal(lines.length,0);
 windowsDoctorDiagnostic(14,999,4);windowsDoctorDiagnostic(7,81,4);assert.equal(lines.length,0);
 }finally{Object.defineProperty(process,'platform',platform);globalThis.__castlinkWindowsNativeRuntime=prior;fs.writeSync=write;}
});
test('actual broker context-held validation localizes refusal before opcode8 and preserves status4',async()=>{
 const {createNativeBrokerClient}=await import('../dist/windows-native-broker.js'),write=fs.writeSync,lines=[],opcodes=[];let frame,at;
 const channel={available:()=>true,write(bytes){opcodes.push(bytes[5]);const payload=Buffer.from(JSON.stringify({status:'context-held',SECRET:'PRIVATE_PATH'}));frame=Buffer.alloc(12+payload.length);frame.writeUInt32LE(payload.length+8);frame[4]=1;frame.writeUInt32LE(bytes.readUInt32LE(8),8);payload.copy(frame,12);at=0;},read(n){const part=frame.subarray(at,at+n);at+=n;return part}};
 try{fs.writeSync=(fd,text)=>{assert.equal(fd,2);lines.push(text);return Buffer.byteLength(text)};assert.throws(()=>createNativeBrokerClient(channel).executeSync('docker-preflight-v1',{action:'observe'}),e=>e.code===4);assert.deepEqual(opcodes,[14]);assert.deepEqual(lines,['{"schemaVersion":1,"operation":8,"stage":80,"status":4}\n']);}finally{fs.writeSync=write}
});
