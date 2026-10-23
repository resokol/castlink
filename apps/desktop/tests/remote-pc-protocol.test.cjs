'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseRemoteLaunch,isRemoteLaunch,windowHandle}=require('../src/remote-pc-protocol.cjs');
const ticket='rp1_'+ 'a'.repeat(43),link='castlink-remote://connect?server=https%3A%2F%2Fstudio.example#'+ticket;
test('remote purpose scheme accepts exact HTTPS origin and remote ticket only',()=>{
 assert.deepEqual(parseRemoteLaunch(link),{server:'https://studio.example',ticket});assert.equal(isRemoteLaunch(link),true);
 for(const bad of [link.replace('rp1_','cp2_'),link+'&a=1',link.replace('https%3A','http%3A'),link.replace('connect?','connect/path?'),link.replace('#','&server=x#'),link.replace('studio.example','user%40studio.example'),link+'\n'])assert.throws(()=>parseRemoteLaunch(bad));
});
test('real Electron Aura window IDs bind strictly to first HWND',()=>{
 assert.equal(windowHandle('window:123:82'),'123');assert.equal(windowHandle('window:9223372036854775807:0'),'9223372036854775807');
 for(const bad of ['window:0:1','window:001:0','window:123:-1','window:9223372036854775808:0','window:123:0:1','screen:123:0'])assert.equal(windowHandle(bad),null);
});

test('dedicated remote fixture optin accepts exact127loopback only; production rejects',()=>{const link='castlink-remote://connect?server='+encodeURIComponent('http://127.0.0.1:4455')+'#'+ticket;assert.throws(()=>parseRemoteLaunch(link));assert.equal(parseRemoteLaunch(link,{allowLoopback:true}).server,'http://127.0.0.1:4455');assert.throws(()=>parseRemoteLaunch(link.replace('127.0.0.1','example.com'),{allowLoopback:true}));});

test('standalone share scheme coexists with remote while explicit entry scheme stays bound',()=>{const share=link.replace('castlink-remote:','castlink-share:');assert.equal(isRemoteLaunch(share),true);assert.deepEqual(parseRemoteLaunch(share),{server:'https://studio.example',ticket});assert.deepEqual(parseRemoteLaunch(share,{scheme:'castlink-share:'}),{server:'https://studio.example',ticket});assert.throws(()=>parseRemoteLaunch(link,{scheme:'castlink-share:'}));assert.throws(()=>parseRemoteLaunch(share,{scheme:'castlink-remote:'}));assert.throws(()=>parseRemoteLaunch(share,{scheme:'https:'}));assert.throws(()=>parseRemoteLaunch(share.replace('castlink-share:','castlink-presenter:')));});
