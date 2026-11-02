'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createMacHelperLauncher}=require('../src/macos-helper-launch.cjs');
const remote='castlink-remote://connect?server=https%3A%2F%2Fstudio.example#rp1_'+'a'.repeat(43);
const presenter='castlink-presenter://connect?server=https%3A%2F%2Fstudio.example#cp2_'+'a'.repeat(43);
test('helper launch validates protocol before fixed executable without shell',async()=>{
 const calls=[];const launch=createMacHelperLauncher({executable:'/Applications/CastLink.app/Contents/MacOS/CastLink',spawn:(...args)=>{calls.push(args);const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child;}});
 assert.equal(await launch(remote),true);assert.equal(await launch(presenter),true);
 assert.deepEqual(calls[0][1],[remote]);assert.equal(calls[0][2].shell,false);
 assert.equal(await launch('castlink://join?url=anything'),false);
 await assert.rejects(()=>launch('castlink-remote://connect?server=http://evil#rp1_'+'a'.repeat(43)));
 assert.equal(calls.length,2);
});
test('failed spawning never reports started or leaks ticket',async()=>{
 const launch=createMacHelperLauncher({executable:'/app/client',spawn:()=>{throw Error(remote);}});
 await assert.rejects(()=>launch(remote),error=>error.message==='Could not open local component');
});
